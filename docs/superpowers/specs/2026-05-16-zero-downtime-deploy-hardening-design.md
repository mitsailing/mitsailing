# Zero-downtime deploy hardening design

## Context

Production deploys happen after a PR merges to `main`. GitHub Actions builds one
Docker image for the merged SHA, pushes `ghcr.io/mitsailing/mitsailing:sha-<short>`,
syncs the production Compose files and deploy script to the Linux host, and runs
`~/deploy.sh release <sha-short>`.

The production stack is Docker Compose on one Linux host:

- `app` is a stable internal nginx proxy reached by Cloudflare Tunnel.
- `web_blue` and `web_green` are the real Next.js standalone containers.
- `worker` runs BullMQ processors from the same app image.
- `postgres` and `redis` are durable host bind mounts under `/srv/mitsailing-data`.
- CMS media files are durable host bind mounts under `/srv/mitsailing-data/cms-media`.

The current target is not per-PR preview deployment. It is production-grade,
zero-downtime release after merge, with operator runbooks for rollback and for
turning cron-driven background work on later.

## Goals

- Preserve public web availability during production releases.
- Preserve in-flight admin media uploads during production releases.
- Keep `web_blue`, `web_green`, and `worker` on the requested immutable SHA.
- Keep Redis and Postgres durable across deploys and accidental
  `docker compose down -v`.
- Keep the BullMQ worker single-instance until job processors are proven safe to
  run concurrently.
- Keep cron-backed legacy MySQL sync disabled by default, with an explicit
  operator path to enable it.
- Keep migrations backward-compatible across overlapping old/new app versions.
- Align with Next.js self-hosting requirements for standalone Docker,
  multi-instance deploys, Server Actions encryption, and cache behavior.

## Non-goals

- Add Kubernetes, Nomad, Swarm, or another orchestrator.
- Build per-PR preview infrastructure.
- Add automated database rollback.
- Enable legacy MySQL sync by default.
- Make every historical migration reversible.
- Replace local CMS media storage with object storage in this change.

## Recommended approach

Keep the explicit blue/green Compose design and harden the deploy script and
runbooks around it.

The production release must start the inactive web color with the pinned
image, wait for container health, verify the CMS media bind mount, run a
protected readiness smoke against Postgres and Redis, write nginx upstream
config for the new color, reload nginx, record release state, restart the
single worker on the same image, then drain the old web color before stopping
it.

This is simpler and more auditable than Compose service scaling. The stable
nginx `app` container gives Cloudflare Tunnel one internal target, while
`web_blue`/`web_green` make image identity and rollback explicit.

## Production release flow

1. `release <sha>` validates the command, takes a `flock`, and refuses
   unsupported shell input.
2. The script writes `.env.image` with:
   - `APP_IMAGE=ghcr.io/mitsailing/mitsailing:<sha>`
   - `DEPLOYMENT_VERSION=<sha>`
3. The script pulls the image and prepares the CMS media mount for runtime
   UID/GID `1001:1001`.
4. The script starts Postgres and Redis, waits for health, and verifies their
   bind mounts and write access.
5. Prisma migrations run from the target app image before proxy cutover.
6. The inactive web color starts with the target app image.
7. The script waits for the inactive web color to become healthy and verifies
   the CMS media bind mount and write access.
8. The script calls the protected readiness endpoint inside the target web
   container when `HEALTHCHECK_SECRET` is set. Readiness must prove required
   Postgres and Redis checks pass.
9. The script writes nginx config pointing to the target web color, validates
   config with `nginx -t`, reloads nginx, and waits for `app` health.
10. The script records active color, current ref, and previous ref in `.deploy/`.
11. The script recreates the single `worker` with the same `.env.image`, waits
    for the worker healthcheck, and verifies CMS media access.
12. The script waits through an upload-safe drain window before stopping the old
    web color.

Rollback uses the same deploy-without-migrations path and does not reverse
database migrations.

## Image pinning

`.env.image` is deploy-owned state. It is rewritten by `bin/deploy.sh` on every
`release`, `deploy`, `migrate`, and `rollback` path.

`.env.production` and `.env.production.example` must not define
`APP_IMAGE=latest`. A stale `APP_IMAGE=latest` in the host env can cause manual
Compose commands to recreate `worker` or a web color from the floating tag.

The deploy script and docs must make safe manual commands include `.env.image`
whenever app or worker services are started, recreated, inspected, or logged.

## Upload-safe cutover

Admin media upload availability has two separate requirements:

- Durable storage: both web colors and the worker mount the same host path,
  `/srv/mitsailing-data/cms-media`, at `/var/lib/mitsailing/cms-media`.
- Connection draining: the old web color must not be stopped while it may still
  be handling an upload accepted before nginx reload.

The current production admin upload surface is the catalog/CMS media flow:

- `src/components/mit-sailing/admin/catalog/AdminRichTextEditor.tsx`
- `src/components/mit-sailing/admin/catalog/AdminCmsMediaControls.tsx`
- `src/app/api/admin/cms-media/route.ts`
- `src/libs/mit-sailing/cmsMediaStorage.ts`

Those controls currently accept JPEG, PNG, WebP, and GIF images. The route writes
to the shared bind mount using a temporary file and `rename`, then records the DB
asset. That storage pattern is compatible with blue/green as long as both web
colors use the same mount and the old color is not stopped mid-request.

If video upload is added to the admin CMS media flow, it must use the same
shared-storage contract. The drain window and proxy timeouts must then be sized
for the largest supported videos and the slowest expected upload clients, or the
upload route must become resumable/direct-to-object-storage before the drain
window is shortened.

`src/app/api/email-assets/route.ts` is not compatible with production-persistent
uploads as currently shaped because it writes to container-local
`public/email-assets`. Before relying on that route in production admin
workflows, either gate it to local/dev email preview usage or move it to the same
persistent media storage pattern.

The deploy default drain window must be at least as long as the upload-facing
proxy timeouts unless the deploy script learns to observe active upstream
connections. With the current nginx settings, `client_body_timeout`,
`send_timeout`, and `proxy_read_timeout` are 900 seconds, so the default
`DEPLOY_DRAIN_SECONDS` must remain 900 seconds. A shorter default, such as
120 seconds, is not upload-safe for slow or large uploads.

If operators later reduce maximum upload size or timeout policy, they can lower
the drain window in the same change. If upload volume becomes high enough that a
15-minute old-color overlap is operationally painful, add an active drain check
before shortening the default.

## Redis, worker, and cron

Redis is production state because BullMQ jobs, retries, and schedulers live
there. Production Redis must keep the explicit host bind mount at
`/srv/mitsailing-data/redis -> /data`, use append-only persistence, and be
excluded from Docker-managed volume deletion.

The worker owns two background-job surfaces:

- immediate/durable jobs, such as newsletter and pavilion reservation email work
- scheduled jobs, such as legacy MySQL sync when enabled

BullMQ does schedule cron jobs automatically after a scheduler is registered in
Redis. It does not automatically notice that an operator changed
`.env.production.worker`. The worker reads env on startup, then:

- `LEGACY_MYSQL_SYNC_ENABLED=false`: calls `removeJobScheduler(...)`
- `LEGACY_MYSQL_SYNC_ENABLED=true`: calls `upsertJobScheduler(...)`

Therefore enabling cron requires changing `.env.production.worker` and
recreating the worker so startup re-applies the scheduler:

```bash
cd ~/apps/mitsailing
$EDITOR .env.production.worker
```

Set:

```dotenv
LEGACY_MYSQL_SYNC_ENABLED=true
LEGACY_MYSQL_SYNC_CRON="0 0 * * * *"
LEGACY_MYSQL_PASSWORD=<real readonly mysql password>
```

Then recreate the worker with the pinned image:

```bash
docker compose -f compose.yaml -f compose.prod.yaml \
  --profile release \
  --env-file .env.production \
  --env-file .env.image \
  --env-file .env.production.worker \
  up -d --force-recreate worker
```

Check health and logs:

```bash
docker compose -f compose.yaml -f compose.prod.yaml \
  --profile release \
  --env-file .env.production \
  --env-file .env.image \
  ps worker

docker compose -f compose.yaml -f compose.prod.yaml \
  --profile release \
  --env-file .env.production \
  --env-file .env.image \
  logs -f --tail 100 worker
```

The cron string is six fields, seconds first. The default
`0 0 * * * *` runs at the top of each hour.

## Postgres and migrations

Production Postgres uses `/srv/mitsailing-data/postgres -> /var/lib/postgresql`
and must not be replaced by Docker-managed named volumes.

Deploy-time migrations run before web cutover. Because the old and new web colors
overlap, migrations must follow expand/contract discipline:

- Add columns, tables, indexes, and enum values before new code depends on them.
- Deploy code that works against both the previous and expanded schema when
  possible.
- Avoid same-release destructive drops, renames, and enum removals.
- Contract only after a later release proves old code no longer reads the old
  shape.

Readiness checks must be bounded so a slow or locked database does not hang a
release indefinitely. The app-level readiness endpoint must run a small
Postgres check with a server-side statement timeout and a Prisma transaction
timeout.

## Next.js self-hosting requirements

The app must keep `output: 'standalone'` and run `node server.js` in the
production image.

`DEPLOYMENT_VERSION` must be set from the pinned SHA and passed to Next.js
`deploymentId` so clients can hard-navigate across version skew during
multi-instance deploys.

`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` must be set to one stable generated value
for production before overlapping web containers are used. This prevents Server
Actions encryption mismatch across old/new instances.

The default Next.js cache is process-local. This stack can tolerate that for
current low-risk ISR/use-cache behavior, but any future heavy shared cache
requirement must add a custom cache handler backed by Redis or another durable
store. Until then, app data that must be immediately consistent must keep
using request-bound rendering, server actions with `revalidatePath`/`updateTag`,
or database reads that do not depend on process-local cache coherence.

## File permissions and data ownership

The bootstrap script remains the one-time authority for host directory creation:

- `/srv/mitsailing-data`
- `/srv/mitsailing-data/postgres`
- `/srv/mitsailing-data/redis`
- `/srv/mitsailing-data/cms-media`

Those paths must be mode `700` and owned by the deploy user/group on the host.
The bootstrap and deploy scripts must prepare container-internal ownership with
the relevant official image users:

- Postgres data writable by `postgres`
- Redis data writable by `redis`
- CMS media writable by app runtime UID/GID `1001:1001`

Each release must verify bind mounts and write access before cutover.

## Error handling and recovery

- If prerequisites or bind mounts are missing, fail before cutting over.
- If migrations fail, keep the old web color serving traffic.
- If the inactive web color fails health or readiness, keep the old web color
  serving traffic and print logs.
- If nginx config validation fails, keep the old config and fail the deploy.
- If worker restart fails after web cutover, fail the deploy and leave web
  serving on the new color; operator recovery is to fix worker env/secrets and
  recreate worker with `.env.image`.
- Rollback changes app/worker image only and must state that database migrations
  are not reversed.

## Testing and verification

Add static deploy-contract tests for:

- `.env.production.example` does not define `APP_IMAGE=latest`.
- Production docs tell operators not to recreate app or worker with only
  `.env.production`.
- Manual worker recreate commands include `.env.image` and `.env.production.worker`.
- Deploy script keeps a 900-second default drain or implements active connection
  draining.
- Deploy script writes `.env.image`, starts the inactive color, runs readiness
  before cutover, reloads nginx, restarts worker, and drains before stopping the
  old color.
- Compose production config keeps Postgres, Redis, and CMS media as explicit bind
  mounts under `/srv/mitsailing-data`.

Run local verification after implementation:

- `npm run test`
- `npm run lint`
- `npm run check:types`
- `npm run check:deps`

Production verification after merge:

- Confirm `.env.image` contains the current `sha-<short>` tag.
- Confirm `docker compose ... ps` shows healthy `app`, active web color,
  `worker`, `postgres`, and `redis`.
- Upload an admin CMS image during a low-risk deploy rehearsal and confirm the
  request completes and the asset is readable after cutover.
- If video uploads are enabled later, repeat the same rehearsal with a
  near-maximum-size video before lowering upload timeouts or drain duration.
- Confirm cron remains disabled unless `.env.production.worker` explicitly sets
  `LEGACY_MYSQL_SYNC_ENABLED=true`.
