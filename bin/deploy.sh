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
#   - `migrate <image-tag>` runs Prisma migrations from that image.
#   - `deploy <image-tag>` recreates app/worker with that image.

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

log() { printf '[deploy %s] %s\n' "$(date -u +'%FT%TZ')" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

# Reject anything that isn't `deploy <ref>` or `migrate <ref>`. Refuses
# arbitrary shell even
# when invoked through authorized_keys, as a second line of defense on top
# of the `command=` restriction.
parse_cmd() {
  # $SSH_ORIGINAL_COMMAND is whatever the remote side sent; authorized_keys
  # forces it through this script as $1..$N.
  local cmd="${1:-}"
  local ref="${2:-}"

  [[ "$cmd" == "deploy" || "$cmd" == "migrate" ]] \
    || fail "unknown command: $cmd (allowed: 'migrate <ref>' or 'deploy <ref>')"
  [[ -n "$ref" ]] || fail "usage: <migrate|deploy> <image-ref>"
  # Image ref allowed set: 0-9a-z plus . _ - : / @
  # That covers `staging`, `sha-abc123`, `main@sha256:...`, etc. without
  # permitting shell metacharacters.
  [[ "$ref" =~ ^[a-zA-Z0-9._:@/\-]+$ ]] || fail "invalid ref: $ref"
  printf '%s %s\n' "$cmd" "$ref"
}

ensure_prereqs() {
  [[ -f compose.yaml && -f compose.prod.yaml ]] \
    || fail "compose files missing in $DEPLOY_DIR — re-run the bootstrap from docs/deploy.md"
  [[ -f "$ENV_FILE" ]] \
    || fail "${ENV_FILE} missing in $DEPLOY_DIR — copy .env.production.example and fill it in"
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
  log "ensuring CMS media bind mount is writable by runtime uid:gid $CMS_MEDIA_RUNTIME_UID_GID"
  docker run \
    --rm \
    --user 0:0 \
    --volume "${CMS_MEDIA_SOURCE}:${CMS_MEDIA_TARGET}" \
    "$APP_IMAGE" \
    sh -c "mkdir -p '${CMS_MEDIA_TARGET}' && chown -R '${CMS_MEDIA_RUNTIME_UID_GID}' '${CMS_MEDIA_TARGET}' && chmod 700 '${CMS_MEDIA_TARGET}'"
}

verify_bind_mount() {
  local service="$1"
  local target="$2"
  local source="$3"
  local container mount_type mount_source
  log "verifying $service bind mount $source -> $target"
  # shellcheck disable=SC2086
  container=$(docker compose $COMPOSE_FILES --env-file "$ENV_FILE" ps -q "$service")
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
  # shellcheck disable=SC2086
  docker compose $COMPOSE_FILES --env-file "$ENV_FILE" exec -T --user "$user" "$service" \
    sh -c "touch '${marker}' && rm -f '${marker}'"
}

verify_data_service_mounts() {
  verify_bind_mount postgres "$POSTGRES_DATA_TARGET" "$POSTGRES_DATA_SOURCE"
  verify_bind_mount redis "$REDIS_DATA_TARGET" "$REDIS_DATA_SOURCE"
  verify_container_write_access postgres postgres "$POSTGRES_DATA_TARGET"
  verify_container_write_access redis redis "$REDIS_DATA_TARGET"
}

verify_cms_media_mounts() {
  verify_bind_mount app "$CMS_MEDIA_TARGET" "$CMS_MEDIA_SOURCE"
  verify_bind_mount worker "$CMS_MEDIA_TARGET" "$CMS_MEDIA_SOURCE"
  verify_container_write_access app "$CMS_MEDIA_RUNTIME_UID_GID" "$CMS_MEDIA_TARGET"
  verify_container_write_access worker "$CMS_MEDIA_RUNTIME_UID_GID" "$CMS_MEDIA_TARGET"
}

pin_image() {
  local ref="$1"
  local image
  image="ghcr.io/${GHCR_OWNER:-mitsailing}/mitsailing:${ref}"
  log "pinning image $image"

  printf 'APP_IMAGE=%s\n' "$image" > .env.image
  set -a
  # shellcheck disable=SC1091
  . .env.image
  set +a

  docker pull "$image"
}

run_migrations() {
  local image="$1"
  log "ensuring postgres and redis are up before migrations"
  # shellcheck disable=SC2086
  docker compose $COMPOSE_FILES --env-file "$ENV_FILE" up -d postgres redis
  verify_data_service_mounts

  log "running prisma migrate deploy from image $image"
  # shellcheck disable=SC2086
  docker compose \
    $COMPOSE_FILES \
    --env-file "$ENV_FILE" \
    run --rm --no-deps app node ./node_modules/prisma/build/index.js migrate deploy
}

run_deploy() {
  local image="$1"
  log "deploying services with image $image"

  # shellcheck disable=SC2086
  docker compose \
    $COMPOSE_FILES \
    --env-file "$ENV_FILE" \
    up \
      --detach \
      --no-deps \
      --force-recreate \
      --pull always \
      app \
      worker
  verify_cms_media_mounts
}

wait_for_app_health() {
  local ref
  ref="$1"

  # Wait up to 60s for HEALTHCHECK so CI fails loudly on a broken deploy.
  local container
  # shellcheck disable=SC2086
  container=$(docker compose $COMPOSE_FILES --env-file "$ENV_FILE" ps -q app)
  [[ -n "$container" ]] || fail "app container did not start"

  local deadline=$((SECONDS + 60))
  while (( SECONDS < deadline )); do
    local status
    status=$(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null || echo "starting")
    if [[ "$status" == "healthy" ]]; then
      log "app is healthy (ref=$ref)"
      # Housekeeping: purge dangling images/layers so the host doesn't
      # accumulate the entire tag history.
      docker image prune --force --filter 'until=168h' >/dev/null || true
      exit 0
    fi
    sleep 2
  done

  log "app did not reach healthy within 60s; tail of last 50 lines:"
  docker logs --tail 50 "$container" >&2 || true
  fail "deploy failed healthcheck"
}

main() {
  local parsed cmd ref
  parsed="$(parse_cmd "$@")"
  cmd="${parsed%% *}"
  ref="${parsed#* }"

  cd "$DEPLOY_DIR" || fail "DEPLOY_DIR not found: $DEPLOY_DIR"
  ensure_prereqs
  ensure_production_data_dirs
  pin_image "$ref"
  ensure_cms_media_permissions

  case "$cmd" in
    migrate)
      run_migrations "$APP_IMAGE"
      log "migrations completed for ref=$ref"
      ;;
    deploy)
      run_deploy "$APP_IMAGE"
      wait_for_app_health "$ref"
      ;;
  esac
}

main "$@"
