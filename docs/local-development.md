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

Use production data locally when a change depends on existing CMS media, admin
records, reservations, newsletters, auth, or migrations.

First sync Postgres using the pgsync workflow documented in
[`../.cursor/skills/pgsync-prod-to-local/SKILL.md`](../.cursor/skills/pgsync-prod-to-local/SKILL.md).
That copies database rows only. It does not copy media files from the production
storage root.

Then copy public ready CMS media:

```shell
export PRODUCTION_SSH_TARGET=username@example.com
node scripts/sync-prod-media.mjs
```

Use your SSH login for the production host. The script copies
`/var/lib/mitsailing/cms-media/ready` from the remote `media` container into
`local/cms-media/ready`; that container path is backed by
`PRODUCTION_DATA_ROOT/cms-media/ready` on the host. It leaves in-progress
`uploads/` files behind.

Defaults:

- SSH target: `--ssh-target` or `PRODUCTION_SSH_TARGET`
- remote app directory: `apps/mitsailing`
- local media root: `local/cms-media`

Override paths when needed:

```shell
node scripts/sync-prod-media.mjs \
  --ssh-target username@example.com \
  --remote-dir apps/mitsailing \
  --local-root local/cms-media
```

## Legacy MySQL Import (Local)

Use this when you need legacy users, events, ratings, news, Pavilion reservations,
or payments from the Pavilion MySQL database.

Production reads `sailing.pavilion.lan` directly from the worker host. Locally,
tunnel through `sailing-dock.mit.edu` and override the host and port:

```shell
ssh -N -L 127.0.0.1:13306:sailing.pavilion.lan:3306 ak@sailing-dock.mit.edu
```

Add to `.env` (see `.env.example`):

```dotenv
LEGACY_MYSQL_PASSWORD=<dock_readonly password>
LEGACY_MYSQL_HOST=127.0.0.1
LEGACY_MYSQL_PORT=13306
```

Run with Postgres up (`npm run dev` or `npm run db:up`):

```shell
npm run legacy:import
```

That reads the needed legacy tables from MySQL and imports users, events,
ratings, news, Pavilion reservations, and payments into app tables.

Safety guards:

- `LEGACY_MYSQL_SYNC_ENABLED=true` is rejected outside production, so the
  worker never schedules production sync locally.
- The import script aborts outside production unless `DATABASE_URL` targets
  `dev_db` on `127.0.0.1` or `localhost`.

App tables are upserted by legacy keys; event dates for legacy events are replaced.

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
