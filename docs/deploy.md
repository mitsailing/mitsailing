# Production Deploy Runbook

This runbook defines the MIT Sailing production deployment target. There is no
MIT Sailing redirect/cutover path to preserve. WordPress remains separate and
untouched at `wp.mitsailing.com`.

## Target Shape

Production runs one MIT Sailing Docker Compose stack on `sailing-dock`:

| Service | Purpose |
| --- | --- |
| `cloudflared` | MIT Sailing tunnel connector only |
| `app` | Stable nginx ingress for blue/green Next.js containers |
| `web_blue`, `web_green` | Next.js standalone app; one active at a time |
| `postgres` | App database in a Docker named volume |
| `redis` | BullMQ Redis in a Docker named volume |
| `tusd` | Resumable CMS upload endpoint |
| `worker` | BullMQ worker and media processor |
| `media` | nginx serving ready CMS media |

Persistent state uses Docker named volumes. Do not require `/srv/mitsailing-data`
or host-installed nginx/cloudflared.

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
- create or chown `/srv/...`;
- enable rootless Docker linger after logout/reboot.

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

Copy `.env.production.example` to `.env.production` on `sailing-dock` and fill
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
| `PRODUCTION_SSH_TARGET` | SSH target, for example `ak@sailing-dock.mit.edu` |
| `PRODUCTION_SSH_PRIVATE_KEY` | Deploy SSH key |
| `PRODUCTION_SSH_HOST_KEY` | Pinned host key lines |
| `NEXT_PUBLIC_SENTRY_DSN` | Build-time Sentry DSN |
| `SENTRY_AUTH_TOKEN` | Build-time source map upload token |

Optional variable:

| Variable | Default |
| --- | --- |
| `PRODUCTION_REMOTE_APP_DIR` | `apps/mitsailing` |

Manual release from a checked-out repo:

```bash
ssh ak@sailing-dock.mit.edu 'mkdir -p apps/mitsailing'
scp compose.yaml compose.prod.yaml ak@sailing-dock.mit.edu:apps/mitsailing/
scp bin/deploy.sh ak@sailing-dock.mit.edu:apps/mitsailing/bin/deploy.sh
scp docker/postgres/init.sql ak@sailing-dock.mit.edu:apps/mitsailing/docker/postgres/init.sql
scp docker/nginx/media.conf ak@sailing-dock.mit.edu:apps/mitsailing/docker/nginx/media.conf
ssh ak@sailing-dock.mit.edu 'chmod +x apps/mitsailing/bin/deploy.sh'
ssh ak@sailing-dock.mit.edu 'DEPLOY_DIR=apps/mitsailing apps/mitsailing/bin/deploy.sh release sha-abc123def456'
```

`bin/deploy.sh release <ref>`:

1. pins `.env.image` to the GHCR image;
2. starts Postgres/Redis and runs Prisma migrations;
3. starts `tusd`, `media`, and `cloudflared` without recreating upload/media;
4. starts the inactive `web_*` container;
5. readiness-checks the new app;
6. rewrites/reloads `app` nginx to point at the new container;
7. restarts `worker`;
8. drains and stops the old `web_*` container.

Rollback:

```bash
ssh ak@sailing-dock.mit.edu 'DEPLOY_DIR=apps/mitsailing apps/mitsailing/bin/deploy.sh rollback previous'
```

Rollback switches app traffic only. It does not reverse database migrations.

## Media Maintenance

Normal app releases should not restart active upload/media services. Use these
commands only during a planned low-traffic window. See
[`docs/media-maintenance.md`](media-maintenance.md) for the full policy,
preflight checklist, verification, and recovery steps.

Restart static media nginx when `docker/nginx/media.conf` changes:

```bash
ssh ak@sailing-dock.mit.edu 'DEPLOY_DIR=apps/mitsailing apps/mitsailing/bin/deploy.sh media-maintenance sha-abc123def456'
```

Restart `tusd` when upload protocol config, max upload size, CORS headers, tusd
image version, or upload storage settings change:

```bash
ssh ak@sailing-dock.mit.edu 'DEPLOY_DIR=apps/mitsailing apps/mitsailing/bin/deploy.sh tusd-maintenance sha-abc123def456'
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

Back up Docker named volumes for:

- `postgres_data`
- `redis_data`
- `cms_media`

Use a tested Docker-volume backup/restore process before relying on production
data. Do not back up or restore the WordPress stack as part of this app runbook.
