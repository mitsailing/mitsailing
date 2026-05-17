#!/usr/bin/env bash
#
# Production deploy script, executed on the Linux host (rootless Docker OK).
#
# Intentional shape: this is the ONLY command the deploy SSH key is allowed
# to run (pin it in ~/.ssh/authorized_keys with
#   command="/home/USER/deploy.sh $SSH_ORIGINAL_COMMAND",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding
# so a compromised deploy key cannot turn into a shell or file transfer.)
#
# Protocol:
#   - `release <image-tag>` runs migrations, blue/green cutover, worker restart.
#   - `rollback <previous|image-tag>` cuts app/worker back without DB rollback.
#   - `migrate <image-tag>` and `deploy <image-tag>` remain manual/debug commands.

set -Eeuo pipefail

# Where compose files + `.env.production` live on the host. Override if you
# keep multiple apps under ~/apps/<name>/.
readonly DEPLOY_DIR="${DEPLOY_DIR:-$HOME/apps/mitsailing}"

# Compose overlay: production (no Mailpit; Resend for mail). Override with
# a full flag sequence, e.g. `DEPLOY_COMPOSE_FILES='-f compose.yaml -f compose.prod.yaml'`.
readonly COMPOSE_FILES="${DEPLOY_COMPOSE_FILES:--f compose.yaml -f compose.prod.yaml}"
readonly ENV_FILE="${DEPLOY_ENV_FILE:-.env.production}"
readonly PRODUCTION_DATA_ROOT="/srv/mitsailing-data"
readonly POSTGRES_DATA_SOURCE="${PRODUCTION_DATA_ROOT}/postgres"
readonly REDIS_DATA_SOURCE="${PRODUCTION_DATA_ROOT}/redis"
readonly CMS_MEDIA_SOURCE="${PRODUCTION_DATA_ROOT}/cms-media"
readonly POSTGRES_DATA_TARGET="/var/lib/postgresql"
readonly REDIS_DATA_TARGET="/data"
readonly CMS_MEDIA_TARGET="/var/lib/mitsailing/cms-media"
readonly CMS_MEDIA_RUNTIME_UID_GID="1001:1001"
readonly DEPLOY_STATE_DIR="${DEPLOY_DIR}/.deploy"
readonly NGINX_STATE_DIR="${DEPLOY_STATE_DIR}/nginx"
readonly NGINX_CONFIG_FILE="${NGINX_STATE_DIR}/default.conf"
readonly ACTIVE_COLOR_FILE="${DEPLOY_STATE_DIR}/active_color"
readonly CURRENT_REF_FILE="${DEPLOY_STATE_DIR}/current_ref"
readonly PREVIOUS_REF_FILE="${DEPLOY_STATE_DIR}/previous_ref"
readonly DEPLOY_LOCK_FILE="${DEPLOY_STATE_DIR}/deploy.lock"
readonly DEPLOY_HEALTH_TIMEOUT_SECONDS="${DEPLOY_HEALTH_TIMEOUT_SECONDS:-120}"
readonly DEPLOY_DRAIN_SECONDS="${DEPLOY_DRAIN_SECONDS:-900}"

log() { printf '[deploy %s] %s\n' "$(date -u +'%FT%TZ')" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

valid_ref() {
  local ref="$1"
  [[ "$ref" =~ ^[a-zA-Z0-9._:@/\-]+$ ]]
}

# Reject anything that isn't a supported command. Refuses arbitrary shell even
# when invoked through authorized_keys, as a second line of defense on top of
# the `command=` restriction.
parse_cmd() {
  local cmd="${1:-}"
  local ref="${2:-}"

  case "$cmd" in
    deploy|migrate|release)
      [[ -n "$ref" ]] || fail "usage: <deploy|migrate|release> <image-ref>"
      valid_ref "$ref" || fail "invalid ref: $ref"
      ;;
    rollback)
      [[ -n "$ref" ]] || fail "usage: rollback <previous|image-ref>"
      [[ "$ref" == "previous" ]] || valid_ref "$ref" || fail "invalid rollback ref: $ref"
      ;;
    *)
      fail "unknown command: $cmd (allowed: 'release <ref>', 'rollback <previous|ref>', 'migrate <ref>', or 'deploy <ref>')"
      ;;
  esac
  printf '%s %s\n' "$cmd" "$ref"
}

compose() {
  # shellcheck disable=SC2086
  docker compose $COMPOSE_FILES --profile release --env-file "$ENV_FILE" "$@"
}

ensure_prereqs() {
  [[ -f compose.yaml && -f compose.prod.yaml ]] \
    || fail "compose files missing in $DEPLOY_DIR — re-run the bootstrap from docs/deploy.md"
  [[ -f "$ENV_FILE" ]] \
    || fail "${ENV_FILE} missing in $DEPLOY_DIR — copy .env.production.example and fill it in"
  command -v flock >/dev/null 2>&1 || fail "flock is required for deploy locking"
}

ensure_deploy_state() {
  mkdir -p "$DEPLOY_STATE_DIR" "$NGINX_STATE_DIR"
}

acquire_deploy_lock() {
  exec 9>"$DEPLOY_LOCK_FILE"
  flock -n 9 || fail "another deploy is already running"
}

ensure_production_data_dirs() {
  [[ -d "$PRODUCTION_DATA_ROOT" ]] \
    || fail "${PRODUCTION_DATA_ROOT} missing — create it from docs/deploy.md before deploying"
  [[ -w "$PRODUCTION_DATA_ROOT" ]] \
    || fail "${PRODUCTION_DATA_ROOT} must be writable by the deploy user"

  log "ensuring production data directories exist under $PRODUCTION_DATA_ROOT"
  mkdir -p "$POSTGRES_DATA_SOURCE" "$REDIS_DATA_SOURCE" "$CMS_MEDIA_SOURCE"
  chmod 700 "$PRODUCTION_DATA_ROOT"
}

ensure_cms_media_permissions() {
  log "ensuring CMS media bind mount top level is writable by runtime uid:gid $CMS_MEDIA_RUNTIME_UID_GID"
  docker run \
    --rm \
    --user 0:0 \
    --volume "${CMS_MEDIA_SOURCE}:${CMS_MEDIA_TARGET}" \
    "$APP_IMAGE" \
    sh -c "mkdir -p '${CMS_MEDIA_TARGET}' && chown '${CMS_MEDIA_RUNTIME_UID_GID}' '${CMS_MEDIA_TARGET}' && chmod 700 '${CMS_MEDIA_TARGET}'"
}

verify_bind_mount() {
  local service="$1"
  local target="$2"
  local source="$3"
  local container mount_type mount_source
  log "verifying $service bind mount $source -> $target"
  container=$(compose ps -q "$service")
  [[ -n "$container" ]] || fail "$service container did not start"

  mount_type=$(docker inspect \
    --format "{{range .Mounts}}{{if eq .Destination \"${target}\"}}{{.Type}}{{end}}{{end}}" \
    "$container")
  mount_source=$(docker inspect \
    --format "{{range .Mounts}}{{if eq .Destination \"${target}\"}}{{.Source}}{{end}}{{end}}" \
    "$container")
  [[ "$mount_type" == "bind" && "$mount_source" == "$source" ]] \
    || fail "$service mount at $target must be bind source $source (actual: ${mount_type:-none} ${mount_source:-none})"
}

verify_container_write_access() {
  local service="$1"
  local user="$2"
  local target="$3"
  local marker="${target}/.mitsailing-write-test"
  log "verifying $service can write $target as $user"
  compose exec -T --user "$user" "$service" \
    sh -c "touch '${marker}' && rm -f '${marker}'"
}

verify_data_service_mounts() {
  verify_bind_mount postgres "$POSTGRES_DATA_TARGET" "$POSTGRES_DATA_SOURCE"
  verify_bind_mount redis "$REDIS_DATA_TARGET" "$REDIS_DATA_SOURCE"
  verify_container_write_access postgres postgres "$POSTGRES_DATA_TARGET"
  verify_container_write_access redis redis "$REDIS_DATA_TARGET"
}

verify_web_mount() {
  local service="$1"
  verify_bind_mount "$service" "$CMS_MEDIA_TARGET" "$CMS_MEDIA_SOURCE"
  verify_container_write_access "$service" "$CMS_MEDIA_RUNTIME_UID_GID" "$CMS_MEDIA_TARGET"
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

  client_max_body_size 500m;
  client_body_timeout 900s;
  send_timeout 900s;
  keepalive_timeout 75s;

  location / {
    proxy_pass http://mitsailing_next;
    proxy_http_version 1.1;
    proxy_request_buffering off;
    proxy_buffering on;
    proxy_connect_timeout 30s;
    proxy_send_timeout 900s;
    proxy_read_timeout 900s;
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
        log "$service status is $status"
      fi
    fi
    sleep 2
  done

  if [[ -n "${container:-}" ]]; then
    log "$service did not become healthy; tail of last 50 lines:"
    docker logs --tail 50 "$container" >&2 || true
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
  verify_web_mount "$service"
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
  verify_bind_mount worker "$CMS_MEDIA_TARGET" "$CMS_MEDIA_SOURCE"
  verify_container_write_access worker "$CMS_MEDIA_RUNTIME_UID_GID" "$CMS_MEDIA_TARGET"
}

run_migrations_for_service() {
  local service="$1"
  log "ensuring postgres and redis are up before migrations"
  compose up --detach postgres redis
  wait_for_service_health postgres "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
  wait_for_service_health redis "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
  verify_data_service_mounts

  log "running prisma migrate deploy from $service image"
  compose run --rm --no-deps "$service" node ./node_modules/prisma/build/index.js migrate deploy
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

    const res = await fetch("http://127.0.0.1:3000/api/health/ready", {
      headers: { Authorization: `Bearer ${secret}` },
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
  ensure_cms_media_permissions
  run_migrations_for_service "$service"
  switch_to_ref "$ref" "$active" "$target"
}

deploy_ref_without_migrations() {
  local ref="$1"
  local active target
  active="$(read_active_color)"
  target="$(inactive_color "$active")"

  pin_image "$ref"
  ensure_cms_media_permissions
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
  ensure_production_data_dirs

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
  esac
}

main "$@"
