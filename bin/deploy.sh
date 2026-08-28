#!/usr/bin/env bash
#
# Production deploy script, executed on the Linux host (rootless Docker OK).
#
# The GitHub deploy workflow uses SSH and SCP to sync compose files and run this
# script. Do not pin that key to a forced command unless file sync moves to a
# separate mechanism.
#
# Protocol:
#   - `release <image-tag>` runs migrations, blue/green cutover, worker restart.
#   - `rollback <previous|image-tag>` cuts app/worker back without DB rollback.
#   - `media-maintenance <image-tag>` restarts only static media nginx.
#   - `tusd-maintenance <image-tag>` restarts only tusd during an operator window.
#   - `migrate <image-tag>` and `deploy <image-tag>` remain manual/debug commands.

set -Eeuo pipefail
umask 077

resolve_deploy_dir() {
  local dir="$1"
  case "$dir" in
    /*) printf '%s\n' "$dir" ;;
    *) printf '%s/%s\n' "$(pwd -P)" "$dir" ;;
  esac
}

# Where compose files + `.env.production` live on the host. Override if you
# keep multiple apps under ~/apps/<name>/.
readonly DEPLOY_DIR="$(resolve_deploy_dir "${DEPLOY_DIR:-$HOME/apps/mitsailing}")"

# Compose overlay: production services, including Mailpit SMTP capture. Override
# with a full flag sequence, e.g. `DEPLOY_COMPOSE_FILES='-f compose.yaml -f compose.prod.yaml'`.
readonly COMPOSE_FILES="${DEPLOY_COMPOSE_FILES:--f compose.yaml -f compose.prod.yaml}"
readonly ENV_FILE="${DEPLOY_ENV_FILE:-.env.production}"
readonly DEPLOY_STATE_DIR="${DEPLOY_DIR}/.deploy"
readonly NGINX_STATE_DIR="${DEPLOY_STATE_DIR}/nginx"
readonly NGINX_CONFIG_FILE="${NGINX_STATE_DIR}/default.conf"
readonly ACTIVE_COLOR_FILE="${DEPLOY_STATE_DIR}/active_color"
readonly CURRENT_REF_FILE="${DEPLOY_STATE_DIR}/current_ref"
readonly PREVIOUS_REF_FILE="${DEPLOY_STATE_DIR}/previous_ref"
readonly DEPLOY_LOCK_FILE="${DEPLOY_STATE_DIR}/deploy.lock"
readonly DEPLOY_HEALTH_TIMEOUT_SECONDS="${DEPLOY_HEALTH_TIMEOUT_SECONDS:-120}"
# The app release drain is intentionally short: tusd/media keep handling uploads
# outside the blue/green web cutover, and nginx upload timeouts track this value.
readonly DEPLOY_DRAIN_SECONDS="${DEPLOY_DRAIN_SECONDS:-120}"
readonly MAILPIT_ROUTE="/mail"
# A server admin must create the default root-owned tree before deploy. Rootless
# hosts may set PRODUCTION_DATA_ROOT to a prepared deploy-user-owned path.
readonly PRODUCTION_DATA_ROOT_WAS_SET="${PRODUCTION_DATA_ROOT+x}"
readonly REQUESTED_PRODUCTION_DATA_ROOT="${PRODUCTION_DATA_ROOT-}"
readonly PRODUCTION_DATA_ROOT="${PRODUCTION_DATA_ROOT:-/srv/mitsailing-data}"
export PRODUCTION_DATA_ROOT
readonly PRODUCTION_POSTGRES_DIR="${PRODUCTION_DATA_ROOT}/postgres"
readonly PRODUCTION_REDIS_DIR="${PRODUCTION_DATA_ROOT}/redis"
readonly PRODUCTION_CMS_MEDIA_DIR="${PRODUCTION_DATA_ROOT}/cms-media"
readonly PRODUCTION_MAILPIT_DIR="${PRODUCTION_DATA_ROOT}/mailpit"

log() { printf '[deploy %s] %s\n' "$(date -u +'%FT%TZ')" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

valid_ref() {
  local ref="$1"
  [[ "$ref" =~ ^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$ ]]
}

# Reject anything that isn't a supported command.
parse_cmd() {
  local cmd="${1:-}"
  local ref="${2:-}"

  case "$cmd" in
    deploy|media-maintenance|migrate|release|tusd-maintenance)
      [[ -n "$ref" ]] || fail "usage: <deploy|media-maintenance|migrate|release|tusd-maintenance> <image-ref>"
      valid_ref "$ref" || fail "invalid ref: $ref"
      ;;
    rollback)
      [[ -n "$ref" ]] || fail "usage: rollback <previous|image-ref>"
      [[ "$ref" == "previous" ]] || valid_ref "$ref" || fail "invalid rollback ref: $ref"
      ;;
    *)
      fail "unknown command: $cmd (allowed: 'release <ref>', 'rollback <previous|ref>', 'migrate <ref>', 'deploy <ref>', 'media-maintenance <ref>', or 'tusd-maintenance <ref>')"
      ;;
  esac
  printf '%s %s\n' "$cmd" "$ref"
}

compose() {
  local env_files
  env_files=(--env-file "$ENV_FILE")
  if [[ -f .env.image ]]; then
    env_files+=(--env-file .env.image)
  fi
  # shellcheck disable=SC2086
  docker compose $COMPOSE_FILES --profile release "${env_files[@]}" "$@"
}

validate_production_data_root() {
  if [[ "$PRODUCTION_DATA_ROOT_WAS_SET" == "x" && -z "$REQUESTED_PRODUCTION_DATA_ROOT" ]]; then
    fail "PRODUCTION_DATA_ROOT must not be empty"
  fi

  case "$PRODUCTION_DATA_ROOT" in
    /*) ;;
    *) fail "PRODUCTION_DATA_ROOT must be an absolute path: $PRODUCTION_DATA_ROOT" ;;
  esac

  [[ "$PRODUCTION_DATA_ROOT" != "/" ]] || fail "PRODUCTION_DATA_ROOT must not be /"
  [[ "$PRODUCTION_DATA_ROOT" != */ ]] || fail "PRODUCTION_DATA_ROOT must not end with /"
  [[ "$PRODUCTION_DATA_ROOT" != *..* && "$PRODUCTION_DATA_ROOT" != *~* ]] \
    || fail "PRODUCTION_DATA_ROOT must not contain .. or ~"
}

ensure_prereqs() {
  validate_production_data_root
  [[ -f compose.yaml && -f compose.prod.yaml ]] \
    || fail "compose files missing in $DEPLOY_DIR — re-run the bootstrap from docs/deploy.md"
  [[ -f "$ENV_FILE" ]] \
    || fail "${ENV_FILE} missing in $DEPLOY_DIR — copy .env.production.example and fill it in"
  command -v flock >/dev/null 2>&1 || fail "flock is required for deploy locking"
}

ensure_deploy_state() {
  mkdir -p "$DEPLOY_STATE_DIR" "$NGINX_STATE_DIR"
  chmod 700 "$DEPLOY_STATE_DIR"
  chmod 700 "$NGINX_STATE_DIR"
}

verify_bind_mount() {
  local service="$1"
  local target="$2"
  local expected_source="$3"
  local container mount_source
  container="$(compose ps -q "$service")"
  [[ -n "$container" ]] || fail "$service container did not start"
  mount_source="$(docker inspect --format "{{range .Mounts}}{{if eq .Destination \"$target\"}}{{.Source}}{{end}}{{end}}" "$container")"
  [[ -n "$mount_source" ]] || fail "$service mount for $target was not found"
  [[ "$mount_source" == "$expected_source" ]] \
    || fail "$service mount for $target is $mount_source, expected $expected_source"
}

verify_cms_media_bind_mount() {
  local service="$1"
  verify_bind_mount "$service" /var/lib/mitsailing/cms-media "$PRODUCTION_CMS_MEDIA_DIR"
}

verify_started_app_cms_media_bind_mounts() {
  local service container
  while IFS= read -r service; do
    case "$service" in
      web_*|worker)
        container="$(compose ps -q "$service")"
        [[ -n "$container" ]] || continue
        verify_bind_mount "$service" /var/lib/mitsailing/cms-media "$PRODUCTION_CMS_MEDIA_DIR"
        ;;
      *)
        ;;
    esac
  done < <(compose config --services)
}

verify_production_bind_mounts() {
  verify_bind_mount postgres /var/lib/postgresql "$PRODUCTION_POSTGRES_DIR"
  verify_bind_mount redis /data "$PRODUCTION_REDIS_DIR"
  verify_bind_mount mailpit /data "$PRODUCTION_MAILPIT_DIR"
  verify_cms_media_bind_mount tusd
  verify_cms_media_bind_mount media
  verify_started_app_cms_media_bind_mounts
}

verify_migration_data_mounts() {
  log "verifying production data mounts before migrations"
  verify_bind_mount postgres /var/lib/postgresql "$PRODUCTION_POSTGRES_DIR"
  verify_bind_mount redis /data "$PRODUCTION_REDIS_DIR"
  compose exec -T postgres sh -ec "test -n \"\${PGDATA:-}\" && test -s \"\${PGDATA}/PG_VERSION\"" \
    || fail "postgres persistent data marker missing at PGDATA/PG_VERSION"
  compose exec -T redis sh -ec 'test -d /data && { test -d /data/appendonlydir || test -s /data/dump.rdb || test -s /data/appendonly.aof; }' \
    || fail "redis persistent data marker missing under /data"
}

acquire_deploy_lock() {
  # flock is attached to fd 9, so a stale lock file from a crashed deploy is harmless.
  # Operators do not need to remove DEPLOY_LOCK_FILE unless a running process holds it.
  exec 9>"$DEPLOY_LOCK_FILE"
  flock -n 9 || fail "another deploy is already running"
}

pin_image() {
  local ref="$1"
  local image
  image="ghcr.io/${GHCR_OWNER:-mitsailing}/mitsailing:${ref}"
  log "pinning image $image"

  printf 'APP_IMAGE=%s\nDEPLOYMENT_VERSION=%s\n' "$image" "$ref" > .env.image
  set -a
  # shellcheck disable=SC1091
  . .env.image
  set +a

  docker pull "$image"
}

normalize_color() {
  local color="$1"
  case "$color" in
    blue|green) printf '%s\n' "$color" ;;
    *) return 1 ;;
  esac
}

read_active_color() {
  if [[ -f "$ACTIVE_COLOR_FILE" ]]; then
    normalize_color "$(tr -d '[:space:]' < "$ACTIVE_COLOR_FILE")" || true
  fi
}

inactive_color() {
  local active="$1"
  if [[ "$active" == "blue" ]]; then
    printf 'green\n'
  else
    printf 'blue\n'
  fi
}

color_service() {
  local color="$1"
  printf 'web_%s\n' "$color"
}

read_state_ref() {
  local file="$1"
  if [[ -f "$file" ]]; then
    tr -d '[:space:]' < "$file"
  fi
}

record_release_state() {
  local color="$1"
  local ref="$2"
  local old_ref="$3"
  printf '%s\n' "$color" > "$ACTIVE_COLOR_FILE"
  printf '%s\n' "$ref" > "$CURRENT_REF_FILE"
  if [[ -n "$old_ref" ]]; then
    printf '%s\n' "$old_ref" > "$PREVIOUS_REF_FILE"
  fi
}

write_nginx_config() {
  local upstream_service="$1"
  log "writing nginx upstream config for $upstream_service"
  cat > "$NGINX_CONFIG_FILE" <<EOF
map \$http_upgrade \$connection_upgrade {
  default upgrade;
  '' '';
}

map \$http_x_forwarded_proto \$forwarded_proto {
  default \$http_x_forwarded_proto;
  '' \$scheme;
}

upstream mitsailing_next {
  server ${upstream_service}:3000;
  keepalive 32;
}

server {
  listen 3000;
  server_name _;
  server_tokens off;
  port_in_redirect off;

  # Docker embedded DNS so Mailpit recreates do not leave a stale upstream IP.
  resolver 127.0.0.11 valid=10s ipv6=off;

  client_max_body_size 500m;
  client_body_timeout ${DEPLOY_DRAIN_SECONDS}s;
  send_timeout ${DEPLOY_DRAIN_SECONDS}s;
  keepalive_timeout 75s;

  location = ${MAILPIT_ROUTE} {
    return 308 ${MAILPIT_ROUTE}/;
  }

  location ${MAILPIT_ROUTE}/ {
    set \$mailpit_upstream mailpit:8025;
    proxy_pass http://\$mailpit_upstream;
    proxy_http_version 1.1;
    proxy_request_buffering off;
    proxy_buffering off;
    proxy_connect_timeout 30s;
    proxy_send_timeout ${DEPLOY_DRAIN_SECONDS}s;
    proxy_read_timeout ${DEPLOY_DRAIN_SECONDS}s;
    proxy_next_upstream off;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host \$host;
    proxy_set_header X-Forwarded-Proto \$forwarded_proto;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
  }

  location / {
    proxy_pass http://mitsailing_next;
    proxy_http_version 1.1;
    proxy_request_buffering off;
    proxy_buffering on;
    proxy_connect_timeout 30s;
    proxy_send_timeout ${DEPLOY_DRAIN_SECONDS}s;
    proxy_read_timeout ${DEPLOY_DRAIN_SECONDS}s;
    proxy_next_upstream off;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host \$host;
    proxy_set_header X-Forwarded-Proto \$forwarded_proto;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
  }
}
EOF
}

wait_for_service_health() {
  local service="$1"
  local timeout_seconds="$2"
  local deadline container status
  deadline=$((SECONDS + timeout_seconds))
  local require_healthy_only='false'
  if [[ "$service" == 'app' || "$service" == web_* ]]; then
    require_healthy_only='true'
  fi

  while (( SECONDS < deadline )); do
    container=$(compose ps -q "$service")
    if [[ -n "$container" ]]; then
      status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || echo "missing")
      if [[ "$status" == 'healthy' || ( "$status" == 'running' && "$require_healthy_only" != 'true' ) ]]; then
        log "$service is healthy"
        return 0
      fi
      if [[ "$status" == "unhealthy" || "$status" == "exited" || "$status" == "dead" ]]; then
        log "$service status is $status; dumping logs and health check output"
        docker logs --tail 50 "$container" >&2 || true
        docker inspect --format '{{json .State.Health.Log}}' "$container" >&2 || true
        fail "$service failed healthcheck"
      fi
    fi
    sleep 2
  done

  if [[ -n "${container:-}" ]]; then
    log "$service did not become healthy; tail of last 50 lines:"
    docker logs --tail 50 "$container" >&2 || true
    docker inspect --format '{{json .State.Health.Log}}' "$container" >&2 || true
  fi
  fail "$service failed healthcheck"
}

start_web_color() {
  local color="$1"
  local service
  service=$(color_service "$color")
  log "starting $service"
  compose up --detach --no-deps --force-recreate --pull always "$service"
  wait_for_service_health "$service" "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
  verify_production_bind_mounts
}

reload_or_start_proxy() {
  log "starting/reloading nginx proxy"
  compose up --detach --no-deps app
  compose exec -T app nginx -t
  compose exec -T app nginx -s reload
  wait_for_service_health app "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
}

restart_worker() {
  log "restarting worker"
  compose up --detach --no-deps --force-recreate --pull always worker
  wait_for_service_health worker "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
  verify_production_bind_mounts
}

run_migrations_for_service() {
  local service="$1"
  log "ensuring postgres and redis are up before migrations"
  compose up --detach --no-recreate postgres redis
  wait_for_service_health postgres "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
  wait_for_service_health redis "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
  verify_migration_data_mounts

  log "running prisma migrate deploy from $service image"
  compose run --rm --no-deps "$service" node ./node_modules/prisma/build/index.js migrate deploy
}

ensure_ingress_services() {
  log "ensuring data, mail, upload, and media services are running"
  compose up --detach --no-recreate postgres redis mailpit pghero_query_stats pghero_space_stats tusd media
  wait_for_service_health postgres "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
  wait_for_service_health redis "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
  wait_for_service_health mailpit "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
  wait_for_service_health pghero_query_stats "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
  wait_for_service_health pghero_space_stats "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
  log "recreating stateless PgHero so compose and env changes apply"
  compose up --detach --no-deps --force-recreate pghero
  wait_for_service_health pghero "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
  wait_for_service_health tusd "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
  wait_for_service_health media "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
  verify_production_bind_mounts
  log "starting and verifying MIT Sailing cloudflared connector"
  compose up --detach --no-deps cloudflared
  wait_for_service_health cloudflared "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
}

restart_media_maintenance() {
  log "restarting static media nginx during explicit maintenance"
  compose up --detach --no-deps --force-recreate media
  wait_for_service_health media "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
}

restart_tusd_maintenance() {
  log "restarting tusd during explicit maintenance"
  compose up --detach --no-deps --force-recreate tusd
  wait_for_service_health tusd "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
}

switch_to_ref() {
  local ref="$1"
  local old_color="$2"
  local target_color="$3"
  local old_ref target_service
  old_ref="$(read_state_ref "$CURRENT_REF_FILE")"
  target_service="$(color_service "$target_color")"

  start_web_color "$target_color"
  # Smoke-check dependency readiness before switching nginx upstream.
  # This is protected by HEALTHCHECK_SECRET and must fail closed if unset.
  # shellcheck disable=SC2016
  compose exec -T "$target_service" node -e '(async () => {
    const secret = process.env.HEALTHCHECK_SECRET;
    if (!secret) {
      console.error("HEALTHCHECK_SECRET is required for readiness smoke");
      process.exit(1);
    }

    const timeoutMs = Number(process.env.DEPLOY_HEALTH_TIMEOUT_SECONDS || 10) * 1000;
    const signal = AbortSignal.timeout(timeoutMs);
    const res = await fetch("http://127.0.0.1:3000/api/health/ready?mode=service", {
      headers: { Authorization: `Bearer ${secret}` },
      signal,
    });

    if (!res.ok) {
      console.error("readiness smoke failed", res.status);
      process.exit(1);
    }
  })().catch((e) => { console.error(e); process.exit(1); });'
  write_nginx_config "$target_service"
  reload_or_start_proxy
  record_release_state "$target_color" "$ref" "$old_ref"
  restart_worker

  if [[ -n "$old_color" && "$old_color" != "$target_color" ]]; then
    log "draining web_${old_color} for ${DEPLOY_DRAIN_SECONDS}s before stop"
    sleep "$DEPLOY_DRAIN_SECONDS"
    compose stop "$(color_service "$old_color")" || true
  elif [[ -z "$old_color" ]]; then
    log "skipping drain: no previous color"
  else
    log "skipping drain: old_color == target_color"
  fi

  docker image prune --force --filter 'until=168h' >/dev/null || true
}

release_ref() {
  local ref="$1"
  local active target service
  active="$(read_active_color)"
  target="$(inactive_color "$active")"
  service="$(color_service "$target")"

  pin_image "$ref"
  run_migrations_for_service "$service"
  ensure_ingress_services
  switch_to_ref "$ref" "$active" "$target"
}

deploy_ref_without_migrations() {
  local ref="$1"
  local active target
  active="$(read_active_color)"
  target="$(inactive_color "$active")"

  pin_image "$ref"
  ensure_ingress_services
  switch_to_ref "$ref" "$active" "$target"
}

migrate_ref_only() {
  local ref="$1"
  local active target service
  active="$(read_active_color)"
  target="${active:-blue}"
  service="$(color_service "$target")"

  pin_image "$ref"
  run_migrations_for_service "$service"
}

rollback_ref() {
  local requested="$1"
  local ref
  if [[ "$requested" == "previous" ]]; then
    ref="$(read_state_ref "$PREVIOUS_REF_FILE")"
    [[ -n "$ref" ]] || fail "no previous ref recorded for rollback"
  else
    ref="$requested"
  fi

  log "rolling back to $ref (database migrations are not reversed)"
  deploy_ref_without_migrations "$ref"
}

main() {
  local parsed cmd ref
  parsed="$(parse_cmd "$@")"
  cmd="${parsed%% *}"
  ref="${parsed#* }"

  cd "$DEPLOY_DIR" || fail "DEPLOY_DIR not found: $DEPLOY_DIR"
  ensure_prereqs
  ensure_deploy_state
  acquire_deploy_lock

  case "$cmd" in
    release)
      release_ref "$ref"
      ;;
    rollback)
      rollback_ref "$ref"
      ;;
    migrate)
      migrate_ref_only "$ref"
      log "migrations completed for ref=$ref"
      ;;
    deploy)
      deploy_ref_without_migrations "$ref"
      ;;
    media-maintenance)
      pin_image "$ref"
      restart_media_maintenance
      ;;
    tusd-maintenance)
      pin_image "$ref"
      restart_tusd_maintenance
      ;;
  esac
}

main "$@"
