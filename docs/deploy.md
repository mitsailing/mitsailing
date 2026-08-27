# Production Deploy

Normal production deploys happen after a PR merges to `main`. Do not SSH for
the routine path.

## Flow

1. Create a branch.
2. Push the branch to GitHub.
3. Open a PR.
4. Wait for all required PR checks, the Docker PR build, code-scanning/security
   gates, and human review.
5. Fix failures and review comments on the branch.
6. If CodeRabbit is unavailable, run a local sub-agent code review before merge.
7. Merge the approved PR to `main`.
8. GitHub runs `Deploy (production)` from `main`.
9. Approve the production environment gate if GitHub asks. The workflow uses
   the `production` environment for both image build secrets and SSH release, so
   approval may happen before the image build and again before release depending
   on GitHub environment settings.
10. Verify production.

Branch prefixes:

- `feature/<slug>`
- `fix/<slug>`
- `issue-<number>-<slug>`
- `docs/<slug>`
- `refactor/<slug>`
- `chore/<slug>`
- `ci/<slug>`
- `test/<slug>`
- `build/<slug>`

The workflow builds the image, syncs the deploy files to the host, then runs:

```bash
PRODUCTION_DATA_ROOT=/home/ak/mitsailing-data \
DEPLOY_DIR=apps/mitsailing \
apps/mitsailing/bin/deploy.sh release sha-abc123def456
```

Use `workflow_dispatch` only to deploy a chosen commit after the normal PR checks
or to replay a known-good commit.

## One-Time Host Prep

Production bind mounts are not auto-created. Missing paths should fail the
deploy before Docker starts.

Current rootless host:

```bash
export PRODUCTION_DATA_ROOT=/home/ak/mitsailing-data
mkdir -p "$PRODUCTION_DATA_ROOT"

docker run --rm --user 0:0 \
  --mount "type=bind,src=${PRODUCTION_DATA_ROOT},dst=/data" \
  alpine:3.20 sh -euxc '
    mkdir -p /data/postgres /data/redis /data/mailpit /data/cms-media/uploads /data/cms-media/ready
    chown 70:70 /data/postgres && chmod 700 /data/postgres
    chown 999:1000 /data/redis && chmod 700 /data/redis
    chmod 700 /data/mailpit
    chown -R 1001:1001 /data/cms-media
    chmod 755 /data/cms-media /data/cms-media/ready
    chmod 700 /data/cms-media/uploads
    apk add --no-cache acl >/dev/null 2>&1 || true
    if command -v setfacl >/dev/null 2>&1; then
      setfacl -m u:101:rx /data/cms-media/ready
      setfacl -d -m u:101:rx /data/cms-media/ready
    else
      chmod -R a+rX /data/cms-media/ready
    fi
  '
```

Long-term default:

```bash
PRODUCTION_DATA_ROOT=/srv/mitsailing-data
```

A sudo-capable admin should prepare the same child folders under `/srv` before
switching the GitHub variable back to the default.

The host also needs `apps/mitsailing/.env.production`. Start from
`.env.production.example`, fill real secrets, and use the MIT Sailing
Cloudflare tunnel token. For the current staging-on-production posture,
`MAIL_TRANSPORT=smtp` sends app mail to Mailpit. Mailpit owns selective
pass-through with `MP_SMTP_RELAY_MATCHING`, so matching recipients such as
`ak@callred.com` and its plus aliases are relayed through Resend SMTP while all
other recipients stay captured.

Permission checks have two surfaces: persistent data under
`PRODUCTION_DATA_ROOT`, and non-secret deploy files that are bind-mounted into
containers. The GitHub workflow normalizes the synced `docker` directories,
compose files, `docker/postgres/init.sql`, and `docker/nginx/media.conf` to
container-readable modes after `scp`; do not apply that chmod pattern to
`.env.production`.

## Cloudflare

Keep WordPress separate. MIT Sailing route order:

- `/cms-media/uploads/*` -> `service: http://tusd:1080`
- `/cms-media/*` -> `service: http://media:8080`
- everything else -> `service: http://app:3000`

Mailpit UI is served by app nginx at `/mail/` and proxied to the in-stack
`mailpit:8025` service. Keep the tunnel route as `everything else -> app:3000`;
do not expose Mailpit as its own public Cloudflare origin.

Production pins the `cloudflare/cloudflared` container tag so base deploys stay
reviewable through Dependabot PRs, CI, image scanning, and production approval.
As a security override, the running tunnel also enables Cloudflare's
`cloudflared` runtime auto-update check with `--autoupdate-freq 24h`. Cloudflare
documents that updates restart `cloudflared` and can affect traffic currently
being served; accept that risk so tunnel security fixes are not delayed until the
next app deploy.

Mailpit also owns outbound pass-through. `compose.prod.yaml` wires
`MP_SMTP_RELAY_*` to Resend SMTP and `MAILPIT_SMTP_RELAY_MATCHING` controls the
matching recipients. The app must stay configured as plain SMTP to Mailpit; do
not add recipient matching logic to the website.

PgHero is served at `/pghero/` by app nginx and proxied to the in-stack
`pghero:8080` service. It is not exposed as its own public origin or host port.
PgHero owns HTTP basic auth through `PGHERO_USERNAME` and `PGHERO_PASSWORD`.
Open `https://mitsailing.com/pghero/` and use those credentials.

PgHero uses a dedicated `PGHERO_DATABASE_URL`; do not point it at the app
superuser URL. Follow PgHero's permissions guide for the exact monitoring role
setup, then set `PGHERO_DATABASE_URL`, `PGHERO_USERNAME`, and
`PGHERO_PASSWORD` in `.env.production`. Query stats use PgHero's documented
`pg_stat_statements` settings in Compose plus the
`CREATE EXTENSION IF NOT EXISTS pg_stat_statements` migration. The built-in
PgHero Tune page links to `https://pgtune.leopard.in.ua/`; use that with the
actual host RAM/CPU and PostgreSQL version before changing Postgres tuning in a
reviewed Compose PR. Do not hand-edit production-only Postgres settings.

Protect `/mail/*` in Cloudflare in addition to Mailpit basic auth:

- Create a Cloudflare Access application for `mitsailing.com/mail/*`.
- Allow only the operator identity that should inspect captured mail, currently
  `ak@callred.com`.
- Add a Cloudflare WAF rate-limit rule for URI path starting with `/mail/`.

## GitHub Environment

Set these on the GitHub `production` environment.

Secrets:

- `PRODUCTION_SSH_TARGET`
- `PRODUCTION_SSH_PRIVATE_KEY`
- `PRODUCTION_SSH_HOST_KEY`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN` — reaches the image build as a BuildKit secret, not a
  build-arg, because `provenance: mode=max` publishes build-arg values in the
  image attestation.

Variables:

```text
PRODUCTION_REMOTE_APP_DIR=apps/mitsailing
PRODUCTION_DATA_ROOT=/home/ak/mitsailing-data
```

Use `/srv/mitsailing-data` for `PRODUCTION_DATA_ROOT` after the long-term host
path exists.

## GHCR pull auth

The production image lives at `ghcr.io/mitsailing/mitsailing`. Package visibility
is independent of the public git repo and defaults to private. The deploy job
grants `packages: read` on the short-lived `GITHUB_TOKEN`, logs into GHCR over
SSH with `--password-stdin` using a per-run `DOCKER_CONFIG` under
`/tmp/mitsailing-ghcr-<run_id>-<run_attempt>/` (so Actions does not touch the
host `~/.docker` auth), sets `DOCKER_HOST` to the rootless user socket when
present, runs `bin/deploy.sh release`, then logs out and removes that config
dir.

The ssh remote payloads run under the host login shell (`/bin/sh`, dash). Keep
them POSIX (`set -eu`, `[ -S "$sock" ]`). Bash-only `set -o pipefail` and `[[`
belong in the Actions runner script, not in the quoted remote command.

Do not leave a long-lived PAT on the host for routine deploys. For break-glass
pulls when Actions cannot run:

```bash
# Prefer an isolated config so this does not fight Actions deploys
export DOCKER_CONFIG="$(mktemp -d)"
uid="$(id -u)"
sock="/run/user/${uid}/docker.sock"
if [[ -S "$sock" ]]; then
  export DOCKER_HOST="unix://${sock}"
fi
# PAT with read:packages only; authorize org SSO if the org requires it
printf '%s\n' "$GHCR_READ_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
docker pull ghcr.io/mitsailing/mitsailing:sha-abc123def456
docker logout ghcr.io
rm -rf "$DOCKER_CONFIG"
```

Before pushing deploy workflow changes, SSH to the production host and run the
quoted remote payload under `sh` (see `.cursor/rules/posix-remote-ssh.mdc`).
Local macOS `sh` is bash and will not catch `pipefail`.

## Verify

Check the workflow first. The `Release production` job should pass.

Then check the site:

```bash
curl -fsSI https://mitsailing.com/api/health/live
mail_status="$(curl -sS -o /dev/null -w '%{http_code}' -I https://mitsailing.com/mail/)"
case "$mail_status" in
  302|401|403) ;;
  2*) echo "ERROR: /mail/ accepted an unauthenticated request" >&2; exit 1 ;;
  *) echo "ERROR: unexpected /mail/ status $mail_status" >&2; exit 1 ;;
esac
pghero_status="$(curl -sS -o /dev/null -w '%{http_code}' -I https://mitsailing.com/pghero/)"
case "$pghero_status" in
  401|403) ;;
  2*) echo "ERROR: PgHero accepted an unauthenticated request" >&2; exit 1 ;;
  *) echo "ERROR: unexpected PgHero status $pghero_status" >&2; exit 1 ;;
esac
curl -fsSI -X OPTIONS https://mitsailing.com/cms-media/uploads/
curl -fsSI https://mitsailing.com/cms-media/healthz
```

If you need host state:

```bash
export PRODUCTION_DATA_ROOT=/home/ak/mitsailing-data

ssh "$PRODUCTION_SSH_TARGET" \
  "cd apps/mitsailing && PRODUCTION_DATA_ROOT='${PRODUCTION_DATA_ROOT}' docker compose -f compose.yaml -f compose.prod.yaml --profile release --env-file .env.production --env-file .env.image ps"
```

## Rollback

There is no rollback button in the workflow. Use the host command only when a
release is bad and the previous app color is still available.

```bash
export PRODUCTION_DATA_ROOT=/home/ak/mitsailing-data

ssh "$PRODUCTION_SSH_TARGET" \
  "PRODUCTION_DATA_ROOT='${PRODUCTION_DATA_ROOT}' DEPLOY_DIR=apps/mitsailing apps/mitsailing/bin/deploy.sh rollback previous"
```

Rollback switches app traffic. It does not reverse database migrations.

## Break Glass

Use direct SSH only after GitHub Actions has already synced the deploy files, or
when you are intentionally rerunning the same host command. Pass
`PRODUCTION_DATA_ROOT`; `.env.production` is not enough for deploy-script path
checks. Log into GHCR first (see [GHCR pull auth](#ghcr-pull-auth)); Actions
uses an isolated `DOCKER_CONFIG` and does not rely on a persistent host login.

```bash
export PRODUCTION_DATA_ROOT=/home/ak/mitsailing-data

ssh "$PRODUCTION_SSH_TARGET" \
  "PRODUCTION_DATA_ROOT='${PRODUCTION_DATA_ROOT}' DEPLOY_DIR=apps/mitsailing apps/mitsailing/bin/deploy.sh release sha-abc123def456"
```

For media-only maintenance, use [media maintenance](media-maintenance.md).
