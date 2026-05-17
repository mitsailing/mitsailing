# Local Development

This guide covers the production-like local stack for MIT Sailing development.
It complements the quick start in the root README.

## Runtime Topology

`npm run dev` runs the app on the host and local dependencies in Docker:

| Service | Where it runs | Default URL or port | Purpose |
| --- | --- | --- | --- |
| Next.js | Host | `http://localhost:3000` | App, admin UI, route handlers, server actions |
| Postgres | Docker | `127.0.0.1:5432` | `dev_db` and `test_db` |
| Redis | Docker | `127.0.0.1:6379` | BullMQ queues and local worker jobs |
| Mailpit | Docker | SMTP `127.0.0.1:1025`, UI `http://127.0.0.1:8025` | Captured local email |
| tusd | Docker | `http://127.0.0.1:1080` | Resumable CMS upload endpoint |
| media nginx | Docker | `http://127.0.0.1:8088` | Serves ready CMS media files |

The Next.js process intentionally stays outside Docker for fast refresh,
source maps, and normal IDE debugging. Docker Compose provides the stateful
services that the host app talks to through loopback ports.

## Daily Workflow

Start the normal development stack:

```shell
npm run dev
```

This runs `db:up`, waits for Postgres, applies migrations, then starts Next.js
and Spotlight. `db:up` starts Postgres, Redis, Mailpit, tusd, and media nginx.

Seed a blank local database once while `npm run dev` is running:

```shell
npm run db:seed
```

Log in at `/login` with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.

## Worker, Queues, And Cron

Run the BullMQ worker in a second terminal only when the behavior you are
developing needs background jobs:

```shell
npm run worker:dev
```

The worker consumes Redis jobs from `REDIS_URL`. Locally that should be:

```dotenv
REDIS_URL=redis://127.0.0.1:6379
```

The worker handles:

- CMS media processing after a tus upload is finalized;
- Pavilion reservation submitted-email jobs;
- newsletter broadcast jobs;
- the legacy MySQL sync scheduler registration path.

The legacy MySQL sync cron remains production-only. `Env.ts` rejects
`LEGACY_MYSQL_SYNC_ENABLED=true` outside production, so local worker startup
removes that scheduler instead of running it. This is intentional; do not enable
legacy production sync locally.

## Local CMS Media Uploads

The local media settings in `.env.example` are:

```dotenv
CMS_MEDIA_ROOT=local/cms-media
MEDIA_STORAGE_ROOT=local/cms-media
MEDIA_UPLOAD_BASE_URL=http://127.0.0.1:1080
MEDIA_PUBLIC_BASE_URL=http://127.0.0.1:8088
MEDIA_UPLOAD_SHARED_SECRET=replace-with-a-32+char-random-string-222222222
```

Upload flow during local development:

1. The admin UI asks the host app for a CMS media upload session.
2. The browser uploads bytes to local tusd at `/cms-media/uploads/`.
3. tusd calls the host app hook through `host.docker.internal:3000`.
4. Finalize checks tusd with `HEAD /cms-media/uploads/<assetId>`.
5. The worker validates the uploaded file and moves it from
   `local/cms-media/uploads/` to `local/cms-media/ready/`.
6. Public media redirects to media nginx at `http://127.0.0.1:8088`.

For upload work, keep both terminals running:

```shell
npm run dev
npm run worker:dev
```

Useful local checks:

```shell
docker compose config tusd media
curl -fsSI http://127.0.0.1:8088/cms-media/healthz
```

## Production Database And Media Locally

Use production data locally when working on CMS, admin, reporting, auth,
reservation, newsletter, or migration behavior.

First sync Postgres using the pgsync workflow documented in
[`../.cursor/skills/pgsync-prod-to-local/SKILL.md`](../.cursor/skills/pgsync-prod-to-local/SKILL.md).
That copies database rows only. It does not copy media files from the production
Docker volume.

Then download public ready CMS media over SSH:

```shell
export PRODUCTION_SSH_TARGET=username@example.com
node scripts/sync-prod-media.mjs
```

Replace `username@example.com` with your SSH login for the production host
before running the command.

Defaults and inputs:

- SSH target: `--ssh-target` or `PRODUCTION_SSH_TARGET`
- remote app directory: `apps/mitsailing`
- local media root: `local/cms-media`
- copied path: production `/srv/mitsailing-data/cms-media/ready`

The script streams a tar archive from the production `media` container:

```shell
ssh <target> 'cd apps/mitsailing && docker compose -f compose.yaml -f compose.prod.yaml --profile release --env-file .env.production --env-file .env.image exec -T media tar -C /var/lib/mitsailing/cms-media -cf - ready'
```

It extracts into `local/cms-media`, producing `local/cms-media/ready/...`.
It merges files into the local tree and does not remove local files. Raw
in-progress uploads under production `uploads/` are intentionally not copied.

Override paths when needed:

```shell
node scripts/sync-prod-media.mjs \
  --ssh-target username@example.com \
  --remote-dir apps/mitsailing \
  --local-root local/cms-media
```

## Port Overrides

If a default port is already in use, change the matching value in `.env`:

| Purpose | Port variable | URL variable to keep aligned |
| --- | --- | --- |
| Postgres | `POSTGRES_PUBLISH_PORT` | `DATABASE_URL`, `TEST_DATABASE_URL` |
| Redis | `REDIS_PUBLISH_PORT` | `REDIS_URL` |
| Mailpit SMTP | `MAILPIT_SMTP_PUBLISH_PORT` | `SMTP_URL` |
| Mailpit UI/API | `MAILPIT_HTTP_PUBLISH_PORT` | `MAILPIT_API_URL` |
| tusd | `MEDIA_UPLOAD_PUBLISH_PORT` | `MEDIA_UPLOAD_BASE_URL` |
| media nginx | `MEDIA_PUBLIC_PUBLISH_PORT` | `MEDIA_PUBLIC_BASE_URL` |

After changing ports, run:

```shell
npm run db:down
npm run dev
```
