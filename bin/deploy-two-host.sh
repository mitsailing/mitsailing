#!/usr/bin/env bash
#
# Two-app-host production deploy controller.
#
# Run this from CI or an operator workstation. It SSHs to:
#   - APP_HOST_BLUE
#   - APP_HOST_GREEN
#   - DATA_MEDIA_HOST
#
# Protocol:
#   - release <image-ref> runs migrations, promotes inactive app host, drains old host.
#   - rollback <previous|image-ref> promotes the inactive host without DB rollback.
#   - migrate <image-ref> runs only Prisma migrations from the data/media host image.
#   - tusd-maintenance <image-ref> restarts tusd during an operator window.

set -Eeuo pipefail

readonly REMOTE_APP_DIR="${REMOTE_APP_DIR:-apps/mitsailing}"
readonly GHCR_OWNER="${GHCR_OWNER:-mitsailing}"
readonly DEPLOY_HEALTH_TIMEOUT_SECONDS="${DEPLOY_HEALTH_TIMEOUT_SECONDS:-120}"
readonly DEPLOY_DRAIN_SECONDS="${DEPLOY_DRAIN_SECONDS:-900}"
readonly APP_COMPOSE_FILE="compose.prod.app-host.yaml"
readonly DATA_COMPOSE_FILE="compose.prod.data.yaml"
readonly DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-${HOME}/.ssh/id_deploy}"
readonly TRAFFIC_STATE_FILE=".deploy/traffic-enabled"
readonly CONTAINER_TRAFFIC_STATE_FILE="/run/mitsailing/traffic-enabled"
readonly ACTIVE_HOST_FILE=".deploy/two-host-active"
readonly CURRENT_REF_FILE=".deploy/two-host-current-ref"
readonly PREVIOUS_REF_FILE=".deploy/two-host-previous-ref"
readonly LOCK_DIR=".deploy/two-host-deploy.lock"
readonly LOCK_STALE_SECONDS="${LOCK_STALE_SECONDS:-7200}"

lock_acquired=false

log() { printf '[deploy-two-host %s] %s\n' "$(date -u +'%FT%TZ')" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

valid_ref() {
  local ref="$1"
  [[ "$ref" =~ ^[a-zA-Z0-9._:@/\-]+$ ]]
}

valid_owner() {
  local owner="$1"
  [[ "$owner" =~ ^[a-zA-Z0-9._\-]+$ ]]
}

require_env() {
  local name="$1"
  [[ -n "${!name:-}" ]] || fail "$name is required"
}

parse_cmd() {
  local cmd="${1:-}"
  local ref="${2:-}"

  case "$cmd" in
    release|migrate|tusd-maintenance)
      [[ -n "$ref" ]] || fail "usage: $cmd <image-ref>"
      valid_ref "$ref" || fail "invalid ref: $ref"
      ;;
    rollback)
      [[ -n "$ref" ]] || fail "usage: rollback <previous|image-ref>"
      [[ "$ref" == "previous" ]] || valid_ref "$ref" || fail "invalid rollback ref: $ref"
      ;;
    *)
      fail "unknown command: $cmd (allowed: 'release <ref>', 'rollback <previous|ref>', 'migrate <ref>', or 'tusd-maintenance <ref>')"
      ;;
  esac

  printf '%s %s\n' "$cmd" "$ref"
}

ssh_remote() {
  local host="$1"
  shift
  ssh -i "$DEPLOY_SSH_KEY" -o BatchMode=yes -o RequestTTY=no -- "$host" "$@"
}

remote_bash() {
  local host="$1"
  shift
  ssh_remote "$host" bash -se -- "$@"
}

color_host() {
  local color="$1"
  case "$color" in
    blue) printf '%s\n' "$APP_HOST_BLUE" ;;
    green) printf '%s\n' "$APP_HOST_GREEN" ;;
    *) fail "unknown app host color: $color" ;;
  esac
}

inactive_color() {
  local active="$1"
  if [[ "$active" == "blue" ]]; then
    printf 'green\n'
  else
    printf 'blue\n'
  fi
}

validate_active_color() {
  local active="$1"
  case "$active" in
    ''|blue|green) ;;
    *) fail "invalid active host state: $active" ;;
  esac
}

read_data_state() {
  local file="$1"
  remote_bash "$DATA_MEDIA_HOST" "$REMOTE_APP_DIR" "$file" <<'REMOTE'
set -Eeuo pipefail
remote_app_dir="$1"
state_file="$2"
cd "$remote_app_dir"
if [[ -f "$state_file" ]]; then
  tr -d '[:space:]' < "$state_file"
fi
REMOTE
}

acquire_lock() {
  remote_bash "$DATA_MEDIA_HOST" "$REMOTE_APP_DIR" "$LOCK_DIR" "$LOCK_STALE_SECONDS" <<'REMOTE'
set -Eeuo pipefail
remote_app_dir="$1"
lock_dir="$2"
lock_stale_seconds="$3"
cd "$remote_app_dir"
mkdir -p .deploy
if [[ -d "$lock_dir" ]]; then
  owner_file="$lock_dir/owner"
  if [[ -f "$owner_file" ]]; then
    created_at="$(awk 'NR == 1 { print $1 }' "$owner_file")"
    now="$(date +%s)"
    if [[ "$created_at" =~ ^[0-9]+$ && $((now - created_at)) -gt "$lock_stale_seconds" ]]; then
      rm -rf "$lock_dir"
    else
      printf 'deploy lock is held: %s\n' "$(tr '\n' ' ' < "$owner_file")" >&2
      exit 1
    fi
  else
    rm -rf "$lock_dir"
  fi
fi
mkdir "$lock_dir"
{
  date +%s
  printf 'host=%s user=%s\n' "$(hostname)" "${USER:-unknown}"
} > "$lock_dir/owner"
REMOTE
  lock_acquired=true
}

release_lock() {
  if [[ "$lock_acquired" != "true" ]]; then
    return
  fi
  remote_bash "$DATA_MEDIA_HOST" "$REMOTE_APP_DIR" "$LOCK_DIR" <<'REMOTE' || true
set -Eeuo pipefail
remote_app_dir="$1"
lock_dir="$2"
cd "$remote_app_dir"
rm -f "$lock_dir/owner"
rmdir "$lock_dir"
REMOTE
}

pin_image_on_host() {
  local host="$1"
  local ref="$2"
  local image="$3"
  log "pinning $image on $host"
  remote_bash "$host" "$REMOTE_APP_DIR" "$ref" "$image" <<'REMOTE'
set -Eeuo pipefail
remote_app_dir="$1"
ref="$2"
image="$3"
cd "$remote_app_dir"
mkdir -p .deploy
printf 'APP_IMAGE=%s\nDEPLOYMENT_VERSION=%s\n' "$image" "$ref" > .env.image
docker pull "$image"
REMOTE
}

pin_image_everywhere() {
  local ref="$1"
  local image="ghcr.io/${GHCR_OWNER}/mitsailing:${ref}"
  pin_image_on_host "$APP_HOST_BLUE" "$ref" "$image"
  pin_image_on_host "$APP_HOST_GREEN" "$ref" "$image"
  pin_image_on_host "$DATA_MEDIA_HOST" "$ref" "$image"
}

ensure_app_traffic_file() {
  local host="$1"
  log "ensuring traffic state file on $host (${TRAFFIC_STATE_FILE} mounted at ${CONTAINER_TRAFFIC_STATE_FILE})"
  remote_bash "$host" "$REMOTE_APP_DIR" "$TRAFFIC_STATE_FILE" <<'REMOTE'
set -Eeuo pipefail
remote_app_dir="$1"
traffic_state_file="$2"
cd "$remote_app_dir"
mkdir -p "$(dirname "$traffic_state_file")"
if [[ ! -f "$traffic_state_file" ]]; then
  printf 'false\n' > "$traffic_state_file"
fi
REMOTE
}

set_app_traffic() {
  local host="$1"
  local enabled="$2"
  remote_bash "$host" "$REMOTE_APP_DIR" "$TRAFFIC_STATE_FILE" "$enabled" <<'REMOTE'
set -Eeuo pipefail
remote_app_dir="$1"
traffic_state_file="$2"
enabled="$3"
cd "$remote_app_dir"
mkdir -p "$(dirname "$traffic_state_file")"
printf '%s\n' "$enabled" > "$traffic_state_file"
REMOTE
}

start_app_host() {
  local host="$1"
  log "starting web on $host with traffic disabled"
  set_app_traffic "$host" false
  remote_bash "$host" "$REMOTE_APP_DIR" "$APP_COMPOSE_FILE" <<'REMOTE'
set -Eeuo pipefail
remote_app_dir="$1"
app_compose_file="$2"
cd "$remote_app_dir"
docker compose -f "$app_compose_file" --env-file .env.production.app-host --env-file .env.image up -d --pull always --force-recreate web
REMOTE
}

wait_for_readiness() {
  local host="$1"
  local mode="$2"
  local path="/api/health/ready"
  if [[ "$mode" == "service" ]]; then
    path="/api/health/ready?mode=service"
  fi

  log "waiting for $mode readiness on $host"
  remote_bash "$host" "$REMOTE_APP_DIR" "$APP_COMPOSE_FILE" "$DEPLOY_HEALTH_TIMEOUT_SECONDS" "$path" <<'REMOTE'
set -Eeuo pipefail
remote_app_dir="$1"
app_compose_file="$2"
timeout_seconds="$3"
ready_path="$4"
cd "$remote_app_dir"
deadline=$((SECONDS + timeout_seconds))
while (( SECONDS < deadline )); do
  if docker compose -f "$app_compose_file" --env-file .env.production.app-host --env-file .env.image exec -T web node -e '
const readyPath = process.argv[1];
(async () => {
  const secret = process.env.HEALTHCHECK_SECRET;
  if (!secret) {
    console.error("HEALTHCHECK_SECRET is required for readiness");
    process.exit(1);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`http://127.0.0.1:3000${readyPath}`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("readiness failed", res.status);
      process.exit(1);
    }
  } finally {
    clearTimeout(timeout);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
' "$ready_path"; then
    exit 0
  fi
  sleep 2
done
docker compose -f "$app_compose_file" --env-file .env.production.app-host --env-file .env.image logs --tail 80 web >&2 || true
exit 1
REMOTE
}

run_migrations() {
  log "running Prisma migrations from $DATA_MEDIA_HOST"
  remote_bash "$DATA_MEDIA_HOST" "$REMOTE_APP_DIR" "$DATA_COMPOSE_FILE" "$DEPLOY_HEALTH_TIMEOUT_SECONDS" <<'REMOTE'
set -Eeuo pipefail
remote_app_dir="$1"
data_compose_file="$2"
health_timeout_seconds="$3"
cd "$remote_app_dir"
compose() {
  docker compose -f "$data_compose_file" --env-file .env.production.data --env-file .env.production.worker --env-file .env.image "$@"
}
wait_for_service_health() {
  service="$1"
  timeout_seconds="$2"
  deadline=$((SECONDS + timeout_seconds))
  while (( SECONDS < deadline )); do
    container="$(compose ps -q "$service")"
    if [ -n "$container" ]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || echo missing)"
      if [ "$status" = healthy ] || [ "$status" = running ]; then
        return 0
      fi
      if [ "$status" = unhealthy ] || [ "$status" = exited ] || [ "$status" = dead ]; then
        echo "$service status is $status" >&2
      fi
    fi
    sleep 2
  done
  if [ -n "${container:-}" ]; then
    docker logs --tail 50 "$container" >&2 || true
  fi
  echo "$service failed healthcheck" >&2
  exit 1
}
docker compose -f "$data_compose_file" --env-file .env.production.data --env-file .env.production.worker --env-file .env.image up -d postgres redis
wait_for_service_health postgres "$health_timeout_seconds"
wait_for_service_health redis "$health_timeout_seconds"
compose run --rm --no-deps worker node ./node_modules/prisma/build/index.js migrate deploy
REMOTE
}

restart_data_worker() {
  log "restarting data/media worker on $DATA_MEDIA_HOST"
  remote_bash "$DATA_MEDIA_HOST" "$REMOTE_APP_DIR" "$DATA_COMPOSE_FILE" <<'REMOTE'
set -Eeuo pipefail
remote_app_dir="$1"
data_compose_file="$2"
cd "$remote_app_dir"
docker compose -f "$data_compose_file" --env-file .env.production.data --env-file .env.production.worker --env-file .env.image up -d --no-deps --force-recreate worker
REMOTE
}

restart_tusd_maintenance() {
  local ref="$1"
  log "restarting tusd during explicit maintenance for ref=$ref on $DATA_MEDIA_HOST"
  remote_bash "$DATA_MEDIA_HOST" "$REMOTE_APP_DIR" "$DATA_COMPOSE_FILE" <<'REMOTE'
set -Eeuo pipefail
remote_app_dir="$1"
data_compose_file="$2"
cd "$remote_app_dir"
docker compose -f "$data_compose_file" --env-file .env.production.data --env-file .env.production.worker --env-file .env.image up -d --no-deps --force-recreate tusd
REMOTE
}

record_state() {
  local active="$1"
  local ref="$2"
  local previous_ref="$3"
  remote_bash "$DATA_MEDIA_HOST" "$REMOTE_APP_DIR" "$ACTIVE_HOST_FILE" "$CURRENT_REF_FILE" "$PREVIOUS_REF_FILE" "$active" "$ref" "$previous_ref" <<'REMOTE'
set -Eeuo pipefail
remote_app_dir="$1"
active_host_file="$2"
current_ref_file="$3"
previous_ref_file="$4"
active="$5"
ref="$6"
previous_ref="$7"
cd "$remote_app_dir"
mkdir -p .deploy
printf '%s\n' "$active" > "$active_host_file"
printf '%s\n' "$ref" > "$current_ref_file"
if [[ -n "$previous_ref" ]]; then
  printf '%s\n' "$previous_ref" > "$previous_ref_file"
fi
REMOTE
}

promote_ref() {
  local ref="$1"
  local target="$2"
  local active="$3"
  local current_ref="$4"
  local target_host
  local active_host
  target_host="$(color_host "$target")"

  run_migrations
  restart_data_worker
  start_app_host "$target_host"
  wait_for_readiness "$target_host" service

  log "promoting $target host"
  set_app_traffic "$target_host" true
  wait_for_readiness "$target_host" public
  record_state "$target" "$ref" "$current_ref"

  if [[ -n "$active" && "$active" != "$target" ]]; then
    active_host="$(color_host "$active")"
    log "demoting $active host after target readiness"
    set_app_traffic "$active_host" false
    log "draining $active host for ${DEPLOY_DRAIN_SECONDS}s"
    sleep "$DEPLOY_DRAIN_SECONDS"
  fi

}

release_ref() {
  local ref="$1"
  local active
  local current_ref
  local target
  active="$(read_data_state "$ACTIVE_HOST_FILE")"
  validate_active_color "$active"
  current_ref="$(read_data_state "$CURRENT_REF_FILE")"
  target="$(inactive_color "$active")"

  pin_image_everywhere "$ref"
  ensure_app_traffic_file "$APP_HOST_BLUE"
  ensure_app_traffic_file "$APP_HOST_GREEN"
  promote_ref "$ref" "$target" "$active" "$current_ref"
}

migrate_ref() {
  local ref="$1"
  pin_image_everywhere "$ref"
  run_migrations
  log "migrations completed for ref=$ref"
}

rollback_ref() {
  local requested="$1"
  local ref="$requested"
  local active
  local current_ref
  local target

  log "rollback switches traffic only; database migrations are not reversed"
  if [[ "$requested" == "previous" ]]; then
    ref="$(read_data_state "$PREVIOUS_REF_FILE")"
    [[ -n "$ref" ]] || fail "no previous ref recorded for rollback"
  fi

  active="$(read_data_state "$ACTIVE_HOST_FILE")"
  validate_active_color "$active"
  [[ -n "$active" ]] || fail "no active host recorded for rollback"
  current_ref="$(read_data_state "$CURRENT_REF_FILE")"
  target="$(inactive_color "$active")"

  pin_image_everywhere "$ref"
  ensure_app_traffic_file "$APP_HOST_BLUE"
  ensure_app_traffic_file "$APP_HOST_GREEN"

  restart_data_worker
  start_app_host "$(color_host "$target")"
  wait_for_readiness "$(color_host "$target")" service

  log "promoting rollback target $target"
  set_app_traffic "$(color_host "$target")" true
  wait_for_readiness "$(color_host "$target")" public
  record_state "$target" "$ref" "$current_ref"
  set_app_traffic "$(color_host "$active")" false
  log "draining $active host for ${DEPLOY_DRAIN_SECONDS}s"
  sleep "$DEPLOY_DRAIN_SECONDS"
}

main() {
  local parsed
  local cmd
  local ref
  parsed="$(parse_cmd "$@")"
  cmd="${parsed%% *}"
  ref="${parsed#* }"

  require_env APP_HOST_BLUE
  require_env APP_HOST_GREEN
  require_env DATA_MEDIA_HOST
  valid_owner "$GHCR_OWNER" || fail "invalid GHCR_OWNER: $GHCR_OWNER"

  trap release_lock EXIT
  acquire_lock

  case "$cmd" in
    release)
      release_ref "$ref"
      ;;
    migrate)
      migrate_ref "$ref"
      ;;
    rollback)
      rollback_ref "$ref"
      ;;
    tusd-maintenance)
      restart_tusd_maintenance "$ref"
      ;;
    *)
      fail "unknown command: $cmd"
      ;;
  esac
}

main "$@"
