#!/usr/bin/env bash
#
# One-time production host bootstrap. Run this from an operator laptop before
# deploying production Compose changes that bind-mount `/srv/mitsailing-data`.

set -Eeuo pipefail

readonly DEFAULT_SSH_TARGET="ak@sailing-dock.mit.edu"
readonly DEFAULT_DATA_ROOT="/srv/mitsailing-data"

usage() {
  cat <<'EOF'
Usage:
  bin/bootstrap-production-server.sh [--check-only] [--remove-old-docker-volumes]

Environment:
  PRODUCTION_SSH_TARGET  SSH target for the production host (default: ak@sailing-dock.mit.edu)
  DEPLOY_USER            Linux user that owns production data (default: SSH user)
  DEPLOY_DIR             Remote app directory (default: /home/$DEPLOY_USER/apps/mitsailing)
  PRODUCTION_DATA_ROOT   Remote production data root (default: /srv/mitsailing-data)

Optional:
  --check-only                  Validate local Compose config and print the resolved target, then exit.
  --remove-old-docker-volumes  Stop the production Compose stack and remove old Docker-managed data volumes.
EOF
}

check_only=false
remove_old_docker_volumes=false
while (($# > 0)); do
  case "$1" in
    --check-only)
      check_only=true
      shift
      ;;
    --remove-old-docker-volumes)
      remove_old_docker_volumes=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

readonly SSH_TARGET="${PRODUCTION_SSH_TARGET:-$DEFAULT_SSH_TARGET}"
ssh_user="${SSH_TARGET%@*}"
if [[ "$ssh_user" == "$SSH_TARGET" ]]; then
  ssh_user="$USER"
fi
readonly DEPLOY_USER="${DEPLOY_USER:-$ssh_user}"
readonly DEPLOY_DIR="${DEPLOY_DIR:-/home/${DEPLOY_USER}/apps/mitsailing}"
readonly PRODUCTION_DATA_ROOT="${PRODUCTION_DATA_ROOT:-$DEFAULT_DATA_ROOT}"

require_safe_value() {
  local name="$1"
  local value="$2"
  [[ "$value" =~ ^[a-zA-Z0-9._/@:-]+$ ]] \
    || {
      printf '%s contains unsupported characters: %s\n' "$name" "$value" >&2
      exit 2
    }
}

require_safe_path() {
  local name="$1"
  local value="$2"
  [[ "$value" == /* && "$value" =~ ^[a-zA-Z0-9._/@:-]+$ ]] \
    || {
      printf '%s must be an absolute path with safe characters: %s\n' "$name" "$value" >&2
      exit 2
    }
}

log() { printf '[bootstrap] %s\n' "$*"; }

validate_compose_config() {
  log "validating rendered production Compose config"
  docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.production.example config --format json |
    node -e '
let input = "";
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  const config = JSON.parse(input);
  const expected = [
    ["postgres", "/var/lib/postgresql", "/srv/mitsailing-data/postgres"],
    ["redis", "/data", "/srv/mitsailing-data/redis"],
    ["app", "/var/lib/mitsailing/cms-media", "/srv/mitsailing-data/cms-media"],
    ["worker", "/var/lib/mitsailing/cms-media", "/srv/mitsailing-data/cms-media"],
  ];
  for (const [service, target, source] of expected) {
    const mount = config.services[service].volumes.find((volume) => volume.target === target);
    if (!mount || mount.type !== "bind" || mount.source !== source) {
      throw new Error(`${service} ${target} expected bind ${source}, got ${JSON.stringify(mount)}`);
    }
  }
  const initSql = config.services.postgres.volumes.find(
    (volume) => volume.target === "/docker-entrypoint-initdb.d/00-init.sql"
  );
  if (!initSql || initSql.type !== "bind" || initSql.read_only !== true) {
    throw new Error("postgres init SQL must be a read-only bind mount");
  }
  console.log("production Compose bind mounts verified");
});
'
}

run_remote_bootstrap() {
  log "connecting to ${SSH_TARGET}"
  ssh -tt "$SSH_TARGET" \
    "DEPLOY_USER='$DEPLOY_USER' DEPLOY_DIR='$DEPLOY_DIR' PRODUCTION_DATA_ROOT='$PRODUCTION_DATA_ROOT' REMOVE_OLD_DOCKER_VOLUMES='$remove_old_docker_volumes' bash -s" <<'REMOTE'
set -Eeuo pipefail

log() { printf '[remote bootstrap] %s\n' "$*"; }
fail() {
  log "ERROR: $*" >&2
  exit 1
}

readonly POSTGRES_DIR="${PRODUCTION_DATA_ROOT}/postgres"
readonly REDIS_DIR="${PRODUCTION_DATA_ROOT}/redis"
readonly CMS_MEDIA_DIR="${PRODUCTION_DATA_ROOT}/cms-media"

log "creating production data directories under ${PRODUCTION_DATA_ROOT}"
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 700 "$PRODUCTION_DATA_ROOT"
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 700 "$POSTGRES_DIR"
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 700 "$REDIS_DIR"
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 700 "$CMS_MEDIA_DIR"
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 755 "$DEPLOY_DIR"
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 755 "${DEPLOY_DIR}/docker"
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 755 "${DEPLOY_DIR}/docker/postgres"

for path in "$PRODUCTION_DATA_ROOT" "$POSTGRES_DIR" "$REDIS_DIR" "$CMS_MEDIA_DIR"; do
  owner="$(stat -c '%U:%G' "$path")"
  mode="$(stat -c '%a' "$path")"
  [[ "$owner" == "${DEPLOY_USER}:${DEPLOY_USER}" ]] \
    || fail "$path owner is $owner, expected ${DEPLOY_USER}:${DEPLOY_USER}"
  [[ "$mode" == "700" ]] \
    || fail "$path mode is $mode, expected 700"
done

if [[ "$REMOVE_OLD_DOCKER_VOLUMES" == "true" ]]; then
  log "removing old Docker-managed production data volumes"
  cd "$DEPLOY_DIR" || fail "DEPLOY_DIR not found: $DEPLOY_DIR"
  docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.production down || true
  docker volume rm mitsailing_postgres_data mitsailing_redis_data mitsailing_cms_media 2>/dev/null || true
fi

log "production host bootstrap complete"
REMOTE
}

sync_init_sql() {
  log "copying postgres init SQL to ${SSH_TARGET}:${DEPLOY_DIR}/docker/postgres/init.sql"
  scp docker/postgres/init.sql "${SSH_TARGET}:${DEPLOY_DIR}/docker/postgres/init.sql"
  ssh "$SSH_TARGET" \
    "DEPLOY_DIR='$DEPLOY_DIR' bash -s" <<'REMOTE'
set -Eeuo pipefail
chmod 644 "${DEPLOY_DIR}/docker/postgres/init.sql"
REMOTE
}

require_safe_value "PRODUCTION_SSH_TARGET" "$SSH_TARGET"
require_safe_value "DEPLOY_USER" "$DEPLOY_USER"
require_safe_path "DEPLOY_DIR" "$DEPLOY_DIR"
require_safe_path "PRODUCTION_DATA_ROOT" "$PRODUCTION_DATA_ROOT"
validate_compose_config
if [[ "$check_only" == "true" ]]; then
  log "check-only target: ${SSH_TARGET}"
  log "check-only deploy user: ${DEPLOY_USER}"
  log "check-only deploy dir: ${DEPLOY_DIR}"
  log "check-only production data root: ${PRODUCTION_DATA_ROOT}"
  exit 0
fi
run_remote_bootstrap
sync_init_sql
