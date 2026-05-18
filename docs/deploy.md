# Production Deploy Runbook

This runbook defines the MIT Sailing production deployment target. There is no
MIT Sailing redirect/cutover path to preserve. WordPress remains separate and
untouched at `wp.mitsailing.com`.

## Target Shape

Production runs one MIT Sailing Docker Compose stack on the production host:

| Service | Purpose |
| --- | --- |
| `cloudflared` | MIT Sailing tunnel connector only |
| `app` | Stable nginx ingress for blue/green Next.js containers |
| `web_blue`, `web_green` | Next.js standalone app; one active at a time |
| `postgres` | App database on `/srv/mitsailing-data/postgres` |
| `redis` | BullMQ Redis on `/srv/mitsailing-data/redis` |
| `tusd` | Resumable CMS upload endpoint |
| `worker` | BullMQ worker and media processor |
| `media` | nginx serving ready CMS media |

Persistent state uses host bind mounts under `/srv/mitsailing-data`. Compose is
configured not to create missing production bind paths, and the deploy script
verifies mounted container sources through Docker after services start. It does
not stat, create, chown, or chmod server-owned data paths. A sudo-capable server
admin must create those paths before the first production release.

## No-Sudo Boundary

The deploy user can do this without sudo:

```bash
mkdir -p ~/apps/mitsailing/bin ~/apps/mitsailing/docker/postgres ~/apps/mitsailing/docker/nginx
# After `bin/deploy.sh release ...` creates `.env.image`, operators can inspect
# or restart the stack with Compose directly:
docker compose -f compose.yaml -f compose.prod.yaml --profile release \
  --env-file .env.production --env-file .env.image up -d
```

The deploy user cannot assume this without an admin:

- install Docker, nginx, cloudflared, or system packages;
- enable rootless Docker linger after logout/reboot.

The deploy script does not use sudo. A server admin must create
`/srv/mitsailing-data` and grant only the container users that need data access.
Use POSIX ACLs where available so the host paths are not readable by ordinary
server users.

Server admin setup:

```bash
sudo useradd --create-home --shell /bin/bash deploy 2>/dev/null || true
sudo passwd -l deploy
sudo usermod -aG docker deploy

sudo install -d -o deploy -g deploy -m 0700 /home/deploy/.ssh
sudo install -d -o deploy -g deploy -m 0700 /home/deploy/apps
sudo install -d -o deploy -g deploy -m 0700 /home/deploy/apps/mitsailing
sudo install -d -o deploy -g deploy -m 0700 /home/deploy/apps/mitsailing/bin
sudo install -d -o deploy -g deploy -m 0700 /home/deploy/apps/mitsailing/docker/postgres
sudo install -d -o deploy -g deploy -m 0700 /home/deploy/apps/mitsailing/docker/nginx

sudo tee /home/deploy/.ssh/authorized_keys >/dev/null <<'KEY'
PASTE_PUBLIC_KEY_HERE
KEY
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
sudo chmod 0600 /home/deploy/.ssh/authorized_keys

command -v setfacl >/dev/null || {
  echo "Install POSIX ACL tools first, then rerun this block." >&2
  exit 1
}

sudo install -d -o root -g root -m 0700 /srv/mitsailing-data
sudo install -d -o 70 -g 70 -m 0700 /srv/mitsailing-data/postgres
sudo install -d -o 999 -g 1000 -m 0700 /srv/mitsailing-data/redis
sudo install -d -o 1001 -g 1001 -m 0700 /srv/mitsailing-data/cms-media
sudo install -d -o 1001 -g 1001 -m 0700 /srv/mitsailing-data/cms-media/uploads
sudo install -d -o 1001 -g 1001 -m 0700 /srv/mitsailing-data/cms-media/ready

sudo setfacl -m u:70:--x,u:999:--x,u:1001:--x,u:101:--x /srv/mitsailing-data
sudo setfacl -m u:101:--x /srv/mitsailing-data/cms-media
sudo setfacl -m u:101:rx /srv/mitsailing-data/cms-media/ready
sudo setfacl -d -m u:101:rx /srv/mitsailing-data/cms-media/ready

sudo -iu deploy docker compose version
```

If rootless Docker stops when the user logs out or the host reboots, ask an
admin to run this once:

```bash
sudo loginctl enable-linger DEPLOY_USER
```

## Cloudflare

Keep the WordPress tunnel untouched:

```text
wp.mitsailing.com -> existing WordPress tunnel/origin
```

Configure a separate MIT Sailing tunnel using this stack's `cloudflared` token.
In Cloudflare Zero Trust, add public hostname/path rules in this order:

```yaml
ingress:
  - hostname: mitsailing.com
    path: ^/cms-media/uploads(/.*)?$
    service: http://tusd:1080

  - hostname: mitsailing.com
    path: ^/cms-media(/.*)?$
    service: http://media:8080

  - hostname: mitsailing.com
    service: http://app:3000

  - service: http_status:404
```

The order is load-bearing. Upload routes must be checked before general media,
and media must be checked before the app catch-all.

## Environment

Copy `.env.production.example` to `.env.production` on the production host and fill
real secrets. Important production values:

```dotenv
NEXT_PUBLIC_APP_URL=https://mitsailing.com
MEDIA_UPLOAD_BASE_URL=https://mitsailing.com
MEDIA_PUBLIC_BASE_URL=https://mitsailing.com
MEDIA_STORAGE_ROOT=/var/lib/mitsailing/cms-media
CMS_MEDIA_ROOT=/var/lib/mitsailing/cms-media
TUSD_HOOKS_HTTP_URL=https://mitsailing.com/api/internal/cms-media/tusd/hooks
DATABASE_URL=postgresql://postgres:...@postgres:5432/mitsailing_prod?schema=public
REDIS_URL=redis://redis:6379
```

`CLOUDFLARE_TUNNEL_TOKEN` must be the MIT Sailing app tunnel token, not the
WordPress tunnel token.

## Deploy

GitHub Actions builds `ghcr.io/mitsailing/mitsailing:sha-<short>` and SSHs to
the production host. Required production environment secrets:

| Secret | Purpose |
| --- | --- |
| `PRODUCTION_SSH_TARGET` | SSH target, for example `deploy@example.com` |
| `PRODUCTION_SSH_PRIVATE_KEY` | Deploy SSH key |
| `PRODUCTION_SSH_HOST_KEY` | Pinned host key lines |
| `NEXT_PUBLIC_SENTRY_DSN` | Build-time Sentry DSN |
| `SENTRY_AUTH_TOKEN` | Build-time source map upload token |

Optional variable:

| Variable | Default |
| --- | --- |
| `PRODUCTION_REMOTE_APP_DIR` | `apps/mitsailing` |

For a new deployment, replace these example values:

| Example | Replace with |
| --- | --- |
| `deploy@example.com` | The SSH target from the server admin, in `user@host` form |
| `apps/mitsailing` | The deploy directory, if the server admin chose a different path |
| `sha-abc123def456` | The image tag or rollback tag you intend to deploy |

Manual release from a checked-out repo:

```bash
export PRODUCTION_SSH_TARGET=deploy@example.com

ssh "$PRODUCTION_SSH_TARGET" 'mkdir -p apps/mitsailing/bin apps/mitsailing/docker/postgres apps/mitsailing/docker/nginx'
scp compose.yaml compose.prod.yaml "$PRODUCTION_SSH_TARGET:apps/mitsailing/"
scp bin/deploy.sh "$PRODUCTION_SSH_TARGET:apps/mitsailing/bin/deploy.sh"
scp docker/postgres/init.sql "$PRODUCTION_SSH_TARGET:apps/mitsailing/docker/postgres/init.sql"
scp docker/nginx/media.conf "$PRODUCTION_SSH_TARGET:apps/mitsailing/docker/nginx/media.conf"
ssh "$PRODUCTION_SSH_TARGET" 'chmod +x apps/mitsailing/bin/deploy.sh'
ssh "$PRODUCTION_SSH_TARGET" 'DEPLOY_DIR=apps/mitsailing apps/mitsailing/bin/deploy.sh release sha-abc123def456'
```

`bin/deploy.sh release <ref>`:

1. pins `.env.image` to the GHCR image;
2. starts Postgres/Redis and runs Prisma migrations;
3. starts `tusd`, `media`, and `cloudflared` without recreating upload/media;
4. starts the inactive `web_*` container;
5. smoke-checks the new app's protected `/api/health/ready` endpoint with `HEALTHCHECK_SECRET`;
6. rewrites/reloads `app` nginx to point at the new container;
7. restarts `worker`;
8. drains and stops the old `web_*` container.

The smoke-check is an authenticated readiness request, not the Docker
HEALTHCHECK. Set `HEALTHCHECK_SECRET` in production so the deploy script can
verify the new container before re-pointing nginx.

Rollback:

```bash
ssh "$PRODUCTION_SSH_TARGET" 'DEPLOY_DIR=apps/mitsailing apps/mitsailing/bin/deploy.sh rollback previous'
```

Rollback switches app traffic only. It does not reverse database migrations.

## Media Maintenance

Normal app releases should not restart active upload/media services. Use these
commands only during a planned low-traffic window. See
[`docs/media-maintenance.md`](media-maintenance.md) for the full policy,
preflight checklist, verification, and recovery steps.

Restart static media nginx when `docker/nginx/media.conf` changes:

```bash
ssh "$PRODUCTION_SSH_TARGET" 'DEPLOY_DIR=apps/mitsailing apps/mitsailing/bin/deploy.sh media-maintenance sha-abc123def456'
```

Restart `tusd` when upload protocol config, max upload size, CORS headers, tusd
image version, or upload storage settings change:

```bash
ssh "$PRODUCTION_SSH_TARGET" 'DEPLOY_DIR=apps/mitsailing apps/mitsailing/bin/deploy.sh tusd-maintenance sha-abc123def456'
```

Restarting `tusd` can interrupt active uploads. That is why app deploys do not
recreate it automatically.

Worker code changes are handled by normal app releases because the worker runs
the app image and is safe to restart after migrations.

## Verification

After configuring Cloudflare and deploying:

```bash
curl -fsSI https://mitsailing.com/api/health/live
curl -fsSI -X OPTIONS https://mitsailing.com/cms-media/uploads/
curl -fsSI https://mitsailing.com/cms-media/healthz
```

Useful server checks:

```bash
cd ~/apps/mitsailing
docker compose -f compose.yaml -f compose.prod.yaml --profile release \
  --env-file .env.production --env-file .env.image ps
docker compose -f compose.yaml -f compose.prod.yaml --profile release \
  --env-file .env.production --env-file .env.image logs -f --tail 100 cloudflared app worker tusd media
```

## Backups

Back up these host paths:

- `/srv/mitsailing-data/postgres`
- `/srv/mitsailing-data/redis`
- `/srv/mitsailing-data/cms-media`

Use a tested filesystem backup/restore process before relying on production
data. Do not back up or restore the WordPress stack as part of this app runbook.
Use daily automated snapshots for these paths, retain 30 daily backups and 12
monthly archives, and run a validated test restore at least quarterly. Target
RTO is under 4 hours; target RPO is under 1 hour.
