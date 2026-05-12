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
  DEPLOY_GROUP           Linux group for deploy-owned files (default: DEPLOY_USER primary group)
  DEPLOY_DIR             Remote app directory (default: /home/$DEPLOY_USER/apps/mitsailing)

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
readonly DEPLOY_GROUP="${DEPLOY_GROUP:-}"
readonly DEPLOY_DIR="${DEPLOY_DIR:-/home/${DEPLOY_USER}/apps/mitsailing}"
readonly PRODUCTION_DATA_ROOT="$DEFAULT_DATA_ROOT"

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
  docker compose -f compose.yaml -f compose.prod.yaml --profile release --env-file .env.production.example config --format json |
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
    ["web_blue", "/var/lib/mitsailing/cms-media", "/srv/mitsailing-data/cms-media"],
    ["web_green", "/var/lib/mitsailing/cms-media", "/srv/mitsailing-data/cms-media"],
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
  const nginxConf = config.services.app.volumes.find(
    (volume) => volume.target === "/etc/nginx/conf.d"
  );
  if (!nginxConf || nginxConf.type !== "bind" || nginxConf.source !== `${process.cwd()}/.deploy/nginx`) {
    throw new Error(`app must bind .deploy/nginx to /etc/nginx/conf.d, got ${JSON.stringify(nginxConf)}`);
  }
  if (config.services.app.image !== "nginx:1.29-alpine") {
    throw new Error(`app service must be nginx proxy, got ${config.services.app.image}`);
  }
  for (const [serviceName, serviceConfig] of Object.entries(config.services)) {
    if (serviceConfig.ports?.length) {
      throw new Error(`${serviceName} must not expose host ports in production`);
    }
  }
  if (config.services.web_blue.image !== config.services.web_green.image) {
    throw new Error("web_blue and web_green must use the same app image");
  }
  console.log("production Compose bind mounts verified");
});
'
}

run_remote_bootstrap() {
  log "connecting to ${SSH_TARGET}"
  ssh -tt "$SSH_TARGET" \
    "DEPLOY_USER='$DEPLOY_USER' DEPLOY_GROUP='$DEPLOY_GROUP' DEPLOY_DIR='$DEPLOY_DIR' PRODUCTION_DATA_ROOT='$PRODUCTION_DATA_ROOT' REMOVE_OLD_DOCKER_VOLUMES='$remove_old_docker_volumes' bash -s" <<'REMOTE'
set -Eeuo pipefail

log() { printf '[remote bootstrap] %s\n' "$*"; }
fail() {
  log "ERROR: $*" >&2
  exit 1
}

readonly POSTGRES_DIR="${PRODUCTION_DATA_ROOT}/postgres"
readonly REDIS_DIR="${PRODUCTION_DATA_ROOT}/redis"
readonly CMS_MEDIA_DIR="${PRODUCTION_DATA_ROOT}/cms-media"
readonly DEPLOY_STATE_DIR="${DEPLOY_DIR}/.deploy"
readonly NGINX_STATE_DIR="${DEPLOY_STATE_DIR}/nginx"
readonly POSTGRES_IMAGE="postgres:18-alpine"
readonly REDIS_IMAGE="redis:7-alpine"
DEPLOY_GROUP="${DEPLOY_GROUP:-$(id -gn "$DEPLOY_USER")}"

log "creating production data directories under ${PRODUCTION_DATA_ROOT}"
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 700 "$PRODUCTION_DATA_ROOT"
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 700 "$POSTGRES_DIR"
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 700 "$REDIS_DIR"
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 700 "$CMS_MEDIA_DIR"
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 755 "$DEPLOY_DIR"
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 755 "${DEPLOY_DIR}/docker"
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 755 "${DEPLOY_DIR}/docker/postgres"
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 755 "$DEPLOY_STATE_DIR"
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 755 "$NGINX_STATE_DIR"

for path in "$PRODUCTION_DATA_ROOT" "$POSTGRES_DIR" "$REDIS_DIR" "$CMS_MEDIA_DIR"; do
  owner="$(stat -c '%U:%G' "$path")"
  mode="$(stat -c '%a' "$path")"
  [[ "$owner" == "${DEPLOY_USER}:${DEPLOY_GROUP}" ]] \
    || fail "$path owner is $owner, expected ${DEPLOY_USER}:${DEPLOY_GROUP}"
  [[ "$mode" == "700" ]] \
    || fail "$path mode is $mode, expected 700"
done

log "preparing postgres and redis bind mounts with official image users"
docker run --rm --user 0:0 --volume "${POSTGRES_DIR}:/var/lib/postgresql" "$POSTGRES_IMAGE" \
  sh -c "mkdir -p /var/lib/postgresql && chown -R postgres:postgres /var/lib/postgresql && chmod 700 /var/lib/postgresql"
docker run --rm --user 0:0 --volume "${REDIS_DIR}:/data" "$REDIS_IMAGE" \
  sh -c "mkdir -p /data && chown -R redis:redis /data && chmod 700 /data"
sudo chmod 700 "$PRODUCTION_DATA_ROOT"

if [[ -f "${DEPLOY_DIR}/.env.production" ]]; then
  log "locking down ${DEPLOY_DIR}/.env.production"
  sudo chown "$DEPLOY_USER:$DEPLOY_GROUP" "${DEPLOY_DIR}/.env.production"
  sudo chmod 600 "${DEPLOY_DIR}/.env.production"
fi

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
if [[ -n "$DEPLOY_GROUP" ]]; then
  require_safe_value "DEPLOY_GROUP" "$DEPLOY_GROUP"
fi
require_safe_path "DEPLOY_DIR" "$DEPLOY_DIR"
require_safe_path "PRODUCTION_DATA_ROOT" "$PRODUCTION_DATA_ROOT"
validate_compose_config
if [[ "$check_only" == "true" ]]; then
  log "check-only target: ${SSH_TARGET}"
  log "check-only deploy user: ${DEPLOY_USER}"
  log "check-only deploy group: ${DEPLOY_GROUP:-remote primary group for ${DEPLOY_USER}}"
  log "check-only deploy dir: ${DEPLOY_DIR}"
  log "check-only production data root: ${PRODUCTION_DATA_ROOT}"
  exit 0
fi
run_remote_bootstrap
sync_init_sql
