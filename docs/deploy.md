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
    mkdir -p /data/postgres /data/redis /data/cms-media/uploads /data/cms-media/ready
    chown 70:70 /data/postgres && chmod 700 /data/postgres
    chown 999:1000 /data/redis && chmod 700 /data/redis
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
Cloudflare tunnel token.

## Cloudflare

Keep WordPress separate. MIT Sailing route order:

- `/cms-media/uploads/*` -> `service: http://tusd:1080`
- `/cms-media/*` -> `service: http://media:8080`
- everything else -> `service: http://app:3000`

## GitHub Environment

Set these on the GitHub `production` environment.

Secrets:

- `PRODUCTION_SSH_TARGET`
- `PRODUCTION_SSH_PRIVATE_KEY`
- `PRODUCTION_SSH_HOST_KEY`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`

Variables:

```text
PRODUCTION_REMOTE_APP_DIR=apps/mitsailing
PRODUCTION_DATA_ROOT=/home/ak/mitsailing-data
```

Use `/srv/mitsailing-data` for `PRODUCTION_DATA_ROOT` after the long-term host
path exists.

## Verify

Check the workflow first. The `Release production` job should pass.

Then check the site:

```bash
curl -fsSI https://mitsailing.com/api/health/live
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
checks.

```bash
export PRODUCTION_DATA_ROOT=/home/ak/mitsailing-data

ssh "$PRODUCTION_SSH_TARGET" \
  "PRODUCTION_DATA_ROOT='${PRODUCTION_DATA_ROOT}' DEPLOY_DIR=apps/mitsailing apps/mitsailing/bin/deploy.sh release sha-abc123def456"
```

For media-only maintenance, use [media maintenance](media-maintenance.md).
