# Zero-downtime deploy hardening design

## Context

Production deploys happen after a PR merges to `main`. GitHub Actions builds one
Docker image for the merged SHA, pushes `ghcr.io/mitsailing/mitsailing:sha-<short>`,
syncs production deployment files, and runs a release command.

The required target is enterprise zero downtime for production deploys. That
includes active users uploading images, files, and videos. Upload continuity is
not optional.

The current branch already creates a server folder for uploaded media. That
folder remains the storage target. We are not using Cloudflare R2, AWS S3, MinIO,
or another S3-compatible object-storage server.

## Required target architecture

Use two headless app hosts behind a proxy/load-balancing layer, plus a separate
Docker data/media server:

- `server-blue` and `server-green` are stateless app hosts.
- Each app host runs the Next.js web container, optional app-local worker
  container, and ingress connector through Docker Compose.
- A separate data/media server runs Docker Compose services for Postgres, Redis,
  media upload, media processing, and media serving.
- Every runtime service we operate must run through Docker/Compose. That
  includes Next.js, BullMQ workers, proxy/connector services, Postgres, Redis,
  the upload endpoint, media-serving nginx, and future media-processing tools.
- Cloudflare Load Balancing is the preferred public proxy. A Dockerized nginx or
  HAProxy layer is also acceptable if it health-checks each app host and can
  shift traffic without a desktop/browser UI.
- Postgres is external to app hosts and runs as a Docker container on the
  data/media server.
- Redis is external to app hosts and runs as a Docker container on the
  data/media server with append-only persistence enabled.
- Uploaded media is stored under a shared durable path on the data/media server,
  for example `/srv/mitsailing-data/cms-media`.
- App hosts must not keep independent uploaded-media folders.

This design gives zero-downtime app deploys and app-host failover while uploads
continue. It does not remove the data/media server as an availability risk. If
that server fails, Postgres, Redis, and uploads are affected. That is a separate
resilience problem from blue/green app deployment.

## Why uploads cannot stay on app-host local folders

If `server-blue` and `server-green` each write uploads to their own local
`/srv/mitsailing-data/cms-media`, a blue/green switch can strand files on the
old host. Public pages and workers on the new host may not see them. That fails
the zero-downtime upload requirement.

If uploads stream through the active Next.js app host, a deploy can be made safe
only by draining long enough for requests to finish. That does not protect an
upload from app-host failure, and it makes deploy timing depend on the largest
active upload. Therefore the durable target is:

- the browser sends media bytes to a Dockerized upload endpoint on the data/media
  server;
- the app creates and finalizes upload sessions through short retryable requests;
- workers process files from the shared media folder;
- public traffic serves ready media from a Dockerized media-serving service.

## Goals

- Preserve public web availability during production releases.
- Preserve in-flight image, file, and video uploads during production releases.
- Preserve upload continuity across app-host failover.
- Keep app and worker services on the requested immutable SHA.
- Keep Redis and Postgres outside the app hosts.
- Keep uploaded media outside the app hosts on the data/media server.
- Process uploaded media through BullMQ workers for validation, metadata,
  thumbnails, and video hooks.
- Keep cron-backed legacy MySQL sync disabled by default, with an explicit
  operator path to enable it.
- Keep migrations backward-compatible across overlapping old/new app versions.
- Align with Next.js self-hosting requirements for standalone Docker,
  multi-instance deploys, Server Actions encryption, and cache behavior.

## Non-goals

- Add Kubernetes, Nomad, or Swarm.
- Add R2, S3, MinIO, or another S3-compatible media server.
- Keep durable production uploads on app-host-local bind mounts.
- Add automated database rollback.
- Enable legacy MySQL sync by default.
- Make the single data/media server highly available in this phase.
- Implement every media derivative immediately. The first production version
  needs durable upload, queue processing, ready/failed states, and a clear
  extension point for thumbnails/transcoding.

## Recommended approach

Use a two-server active/passive blue/green app deployment with a third
data/media server. The inactive app host is updated first, readiness passes,
proxy traffic shifts to it, and the previous app host remains available for
rollback until the release is accepted.

Uploads do not stream through the app host. The app issues an upload session,
the browser uploads directly to a Dockerized upload service on the data/media
server, then the app finalizes the asset and enqueues a BullMQ processing job.
Workers process media from the server folder and mark assets `ready` or
`failed`. The admin UI shows `uploading`, `queued`, `processing`, `ready`, and
`failed` states. Public pages serve only `ready` media.

Use a proven resumable upload service for large files and videos. The preferred
Docker service is `tusd` with file storage rooted under
`/srv/mitsailing-data/cms-media/uploads`. If the team prefers not to add `tusd`,
build a small Node upload service in the same app image and run it on the
data/media server. In either case, the upload service is not the public Next.js
app container on either blue/green host.

## Data/media server services

The data/media server is the durable state host:

- `postgres`
  - Docker image: official Postgres image.
  - Persistent path: `/srv/mitsailing-data/postgres`.
  - Network exposure: private network only, restricted to app-host IPs and
    deploy automation.
- `redis`
  - Docker image: official Redis image.
  - Persistent path: `/srv/mitsailing-data/redis`.
  - Run with append-only persistence.
  - Network exposure: private network only, restricted to app-host IPs and
    deploy automation.
- `media-upload`
  - Docker image: `tusd` or the app image running an upload-service command.
  - Persistent path: `/srv/mitsailing-data/cms-media/uploads`.
  - Handles large file/video uploads without involving app hosts.
- `media-worker`
  - Docker image: the same app image as the release.
  - Persistent path: `/srv/mitsailing-data/cms-media`.
  - Reads uploaded files, validates content, writes ready files and thumbnails,
    and updates Postgres.
- `media`
  - Docker image: nginx or equivalent static file server.
  - Read-only path: `/srv/mitsailing-data/cms-media/ready`.
  - Serves ready assets through `https://media.mitsailing.com` or an equivalent
    proxy route.

Postgres and Redis can remain on one server if that residual risk is accepted.
That preserves zero-downtime app deploys, but the data/media server remains a
single point of failure for database, queue, and media writes.

## Upload pipeline

The upload pipeline has four durable stages:

1. **Create upload session**
   - Admin UI sends filename, size, content type, media kind, and intended usage.
   - App validates size/type policy and creates a DB row with status
     `uploading`.
   - App returns an upload URL and headers for the Dockerized media upload
     service.
   - Large files and videos use resumable upload protocol support from the
     upload service.

2. **Browser uploads to the data/media server**
   - The browser sends bytes directly to the media upload service.
   - App hosts do not proxy the bytes.
   - Raw upload files are stored below a path such as
     `/srv/mitsailing-data/cms-media/uploads/<assetId>`.

3. **Finalize upload**
   - Browser tells the app the upload completed.
   - App verifies the upload exists on the data/media server, changes DB status
     to `queued`, and enqueues a BullMQ job with a stable job id based on the
     asset id.
   - Finalize is idempotent. Retrying it against either app host is safe.

4. **Worker processing**
   - Worker reads the raw file from the data/media server folder.
   - Worker validates MIME signature and policy.
   - Worker extracts metadata.
   - Worker creates required derivatives:
     - images: ready image and optional thumbnail;
     - files: ready download record;
     - videos: ready original plus future transcoding hook.
   - Worker writes ready output under
     `/srv/mitsailing-data/cms-media/ready/<assetId>/<safe-filename>`.
   - Worker marks the asset `ready`.
   - If processing fails after retries, worker marks the asset `failed` with a
     safe error code.

BullMQ does not perform the upload automatically. BullMQ starts after the bytes
are durably stored. It coordinates processing, retries, and cron-like jobs in
Redis.

## Admin media surface

The current production admin upload surface is:

- `src/components/mit-sailing/admin/catalog/AdminRichTextEditor.tsx`
- `src/components/mit-sailing/admin/catalog/AdminCmsMediaControls.tsx`
- `src/app/api/admin/cms-media/route.ts`
- `src/libs/mit-sailing/cmsMediaStorage.ts`

Those controls currently accept JPEG, PNG, WebP, and GIF images and write to
local CMS media storage. The target design keeps the server-folder storage model
but moves durable writes to the data/media server and uses queue-only processing
for images, files, and videos.

Video support must use the same pipeline. Do not add video upload by increasing
Next.js route handler body size limits or proxying large request bodies through
the app hosts.

`src/app/api/email-assets/route.ts` currently writes to container-local
`public/email-assets`. It is not production-persistent. Before relying on that
route in production admin workflows, either gate it to local/dev email preview
usage or migrate it to the data/media server media pipeline.

## Deployment model

The deploy flow changes from single-host color switching to host-level
active/passive blue/green behind Cloudflare Load Balancing or an equivalent
proxy:

1. Build and push immutable image `sha-<short>`.
2. Deploy the image to the inactive app host.
3. Run migrations from the target image against external Postgres on the
   data/media server.
4. Start app services on the inactive host.
5. Run app-host readiness:
   - Next.js liveness;
   - protected readiness;
   - Postgres check;
   - Redis check;
   - data/media server upload-service check;
   - media-serving check.
6. Shift proxy traffic to the inactive host.
7. Keep the previous app host running for rollback.
8. Update the data/media server worker to the new image after compatibility
   checks pass, or run app-host workers only after proving processors are safe
   with shared folder access.

Worker policy for the first implementation:

- Prefer one active `media-worker` service on the data/media server because it
  has local access to `/srv/mitsailing-data/cms-media`.
- Use stable BullMQ job ids and idempotent processors.
- Before allowing multiple media workers, prove every processor is safe under
  concurrency and shared-folder locking.

## Rollback

Rollback shifts proxy traffic back to the previous app host/image after that
host passes readiness. Rollback does not reverse database migrations or file
writes on the data/media server.

To make rollback safe:

- migrations must be expand/contract;
- media DB rows and job payloads must be backward-compatible across at least one
  release;
- upload session records must be finalized idempotently;
- old and new code must both tolerate `uploading`, `queued`, `processing`,
  `ready`, and `failed` media states.

## Redis, worker, and cron

Redis is production state because BullMQ jobs, retries, and schedulers live
there. It must be external to the app hosts for two-host deployment. It runs as
a Docker service on the data/media server with persistent storage. If Redis
stays single-node on that server, app deploys can still be zero-downtime, but
Redis/data-server failure remains a known availability risk.

BullMQ schedules cron jobs automatically after a scheduler is registered in
Redis. It does not automatically notice that an operator changed
`.env.production.worker`. The worker reads env on startup, then:

- `LEGACY_MYSQL_SYNC_ENABLED=false`: calls `removeJobScheduler(...)`
- `LEGACY_MYSQL_SYNC_ENABLED=true`: calls `upsertJobScheduler(...)`

Therefore enabling cron requires changing `.env.production.worker` and
recreating the Docker worker so startup re-applies the scheduler:

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

Then recreate the worker with the pinned image and production worker env:

```bash
docker compose -f compose.prod.data.yaml --env-file .env.production.data up -d media-worker
```

If legacy sync workers run on an app host instead of the data/media server, run
the equivalent `docker compose -f compose.prod.app-host.yaml ... up -d worker`
command on that host.

The cron string is six fields, seconds first. The default
`0 0 * * * *` runs at the top of each hour.

## Postgres and migrations

Production Postgres is a Docker service on the data/media server. App hosts use
`DATABASE_URL` pointing to the data/media server's private IP or private DNS
name. The Postgres port must not be public internet-accessible.

Migrations run once from the target image before the new app host is promoted.
Migrations must be backward-compatible because the previous app image may keep
serving traffic during the promotion window and rollback may shift traffic back
without reversing the migration.

## Next.js production requirements

Keep `output: 'standalone'` for production Docker images.

Set a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` across both app hosts before
overlapping web versions. Otherwise Server Actions payloads can fail when a
request lands on a different app instance than the one that generated the page.

Set `DEPLOYMENT_VERSION` to the image SHA and feed it to `deploymentId` in
`next.config.ts` so clients and server assets are tied to the release.

Health and upload route handlers must run on the Node.js runtime. Do not use
Edge runtime for Prisma, Redis, filesystem coordination, or upload-session
checks.

## Error handling

- If upload-session creation fails, no upload begins.
- If browser upload succeeds but finalize fails, the client can retry finalize.
- If an app host is removed during upload, the upload continues because bytes
  are flowing to the data/media server, not the app host.
- If processing fails, the asset is marked `failed` and remains inspectable in
  admin.
- If Redis is down, finalize cannot enqueue processing and returns a retryable
  error.
- If the data/media server is down, upload and media serving fail. That is the
  accepted residual risk unless we add data/media HA later.
- Rollback changes serving version only and must not delete uploaded files or
  worker outputs.

## Testing requirements

Unit and integration coverage:

- env validation for data/media server paths and URLs;
- upload session creation policy;
- finalize idempotency;
- BullMQ stable job ids;
- worker transitions from `queued` to `processing` to `ready` or `failed`;
- MIME/signature rejection;
- health readiness including Postgres, Redis, upload-service, and media-serving
  checks.

Production rehearsal:

- Start a large image/file/video upload during deploy.
- Confirm browser upload traffic goes to the data/media server upload endpoint,
  not the app host.
- Promote the other app host while the upload continues.
- Confirm finalize can retry on the active app host.
- Confirm the uploaded asset reaches `ready` or `failed` deterministically.
- Confirm rollback does not delete media files or DB rows.
