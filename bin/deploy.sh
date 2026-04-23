#!/usr/bin/env bash
#
# Staging deploy script, executed on the sailing-dock server.
#
# Intentional shape: this is the ONLY command the deploy SSH key is allowed
# to run (pin it in ~/.ssh/authorized_keys with
#   command="/home/ak/deploy.sh $SSH_ORIGINAL_COMMAND",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding
# so a compromised deploy key cannot turn into a shell or file transfer.)
#
# Protocol: the CI workflow sends `deploy <image-tag>` via ssh, we pin that
# tag, pull it, recreate just the `app` service, and return.

set -Eeuo pipefail

# Where the checked-out compose files + .env.staging live on the host.
# Admin sets this up once; see docs/deploy.md.
readonly DEPLOY_DIR="${DEPLOY_DIR:-$HOME/apps/next-js-boilerplate}"

log() { printf '[deploy %s] %s\n' "$(date -u +'%FT%TZ')" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

# Reject anything that isn't `deploy <ref>`. Refuses arbitrary shell even
# when invoked through authorized_keys, as a second line of defense on top
# of the `command=` restriction.
parse_cmd() {
  # $SSH_ORIGINAL_COMMAND is whatever the remote side sent; authorized_keys
  # forces it through this script as $1..$N.
  local cmd="${1:-}"
  local ref="${2:-}"

  [[ "$cmd" == "deploy" ]] || fail "unknown command: $cmd (only 'deploy <ref>' is allowed)"
  [[ -n "$ref" ]]          || fail "usage: deploy <image-ref>"
  # Image ref allowed set: 0-9a-z plus . _ - : / @
  # That covers `staging`, `sha-abc123`, `main@sha256:...`, etc. without
  # permitting shell metacharacters.
  [[ "$ref" =~ ^[a-zA-Z0-9._:@/\-]+$ ]] || fail "invalid ref: $ref"
  printf '%s\n' "$ref"
}

main() {
  local ref
  ref="$(parse_cmd "$@")"

  cd "$DEPLOY_DIR" || fail "DEPLOY_DIR not found: $DEPLOY_DIR"
  [[ -f compose.yaml && -f compose.staging.yaml ]] \
    || fail "compose files missing in $DEPLOY_DIR — re-run the bootstrap from docs/deploy.md"
  [[ -f .env.staging ]] \
    || fail ".env.staging missing in $DEPLOY_DIR — copy .env.staging.example and fill it in"

  local image="ghcr.io/${GHCR_OWNER:-OWNER}/next-js-boilerplate:${ref}"
  log "deploying $image"

  # Persist the ref so subsequent `docker compose` invocations (status
  # checks, manual restarts) pick up the same pinned tag. We source this
  # via env_file rather than rewriting .env.staging so nothing in the
  # deploy loop edits a secrets file.
  printf 'APP_IMAGE=%s\n' "$image" > .env.image
  set -a
  # shellcheck disable=SC1091
  . .env.image
  set +a

  # Docker Hub / GHCR auth is a one-time `docker login` the admin runs
  # (see docs/deploy.md). Pulls here are anonymous-or-authenticated
  # depending on how the package visibility is set.
  docker pull "$image"

  # --no-deps: don't touch postgres/mailpit/cloudflared. --force-recreate
  # is belt-and-braces because `up` only recreates on image change.
  docker compose \
    -f compose.yaml \
    -f compose.staging.yaml \
    --env-file .env.staging \
    up \
      --detach \
      --no-deps \
      --force-recreate \
      --pull always \
      app

  # Wait up to 60s for the HEALTHCHECK to go green so CI fails loudly on
  # a broken deploy rather than declaring success on a crashing container.
  local container
  container=$(docker compose -f compose.yaml -f compose.staging.yaml ps -q app)
  [[ -n "$container" ]] || fail "app container did not start"

  local deadline=$((SECONDS + 60))
  while (( SECONDS < deadline )); do
    local status
    status=$(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null || echo "starting")
    if [[ "$status" == "healthy" ]]; then
      log "app is healthy (image=$image)"
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

main "$@"
