# Zero-downtime deploy hardening design

## Context

Production deploys happen after a PR merges to `main`. GitHub Actions builds one
Docker image for the merged SHA, pushes `ghcr.io/mitsailing/mitsailing:sha-<short>`,
syncs production deployment files, and runs a release command.

The required target is enterprise zero downtime for production deploys. That
includes active users uploading images, files, and videos. Upload continuity is
not optional and cannot depend on a single app host staying alive.

The existing single-host Compose stack is useful as a stepping stone, but it is
not the final architecture for this requirement because:

- a single Linux host is still a single point of failure;
- container-local uploads do not survive color switch or host failure;
- a local bind mount works only while all active app containers run on the same
  host;
- long uploads can outlive a short deploy drain window.

## Required target architecture

Use two app hosts with external durable state:

- `server-blue` and `server-green` each run the same app/worker image through
  Docker Compose.
- Cloudflare Load Balancing routes public traffic to the active app host and
  uses health checks to fail over when the active host is unhealthy.
- Postgres is external to the app hosts.
- Redis is external to the app hosts and durable enough for BullMQ jobs,
  retries, and schedulers.
- Media uploads go to S3-compatible object storage, preferably Cloudflare R2.
- App hosts are stateless with respect to uploaded media.

Cloudflare R2 is the recommended storage target because it is S3-compatible,
fits the existing Cloudflare deployment surface, and supports presigned URLs and
multipart uploads for large objects. AWS S3 remains a compatible fallback if R2
is unavailable.

References:

- Cloudflare R2 multipart and presigned upload docs:
  `https://developers.cloudflare.com/r2/objects/multipart-objects/`
- Cloudflare R2 S3 compatibility:
  `https://developers.cloudflare.com/r2/get-started/s3/`
- Cloudflare Load Balancing health/failover docs:
  `https://developers.cloudflare.com/load-balancing/understand-basics/health-details/`
- Next.js self-hosting requires `output: 'standalone'`, stable deployment IDs,
  and shared cache handling when process-local cache is not enough.

## Goals

- Preserve public web availability during production releases.
- Preserve in-flight image, file, and video uploads during production releases.
- Preserve upload continuity across app-host failover.
- Keep app and worker services on the requested immutable SHA.
- Keep Redis and Postgres outside the app hosts.
- Keep uploaded media outside app hosts in object storage.
- Process uploaded media through BullMQ workers for validation, metadata,
  thumbnails, and video transcoding.
- Keep cron-backed legacy MySQL sync disabled by default, with an explicit
  operator path to enable it.
- Keep migrations backward-compatible across overlapping old/new app versions.
- Align with Next.js self-hosting requirements for standalone Docker,
  multi-instance deploys, Server Actions encryption, and cache behavior.

## Non-goals

- Add Kubernetes, Nomad, or Swarm in this change.
- Keep durable production uploads on local host bind mounts.
- Add automated database rollback.
- Enable legacy MySQL sync by default.
- Make every historical migration reversible.
- Implement every possible media derivative immediately. The first production
  version needs durable upload, queue processing, ready/failed states, and a
  clear extension point for thumbnails/transcoding.

## Recommended approach

Use a two-server active/passive blue/green deployment with stateless app hosts.
The inactive host is updated first, health and readiness pass, Cloudflare traffic
shifts to it, and the previous active host remains available for rollback until
the release is accepted.

Uploads do not stream through the app host. The app issues short-lived upload
instructions for object storage, the browser uploads directly to object storage,
then the app records/finalizes the asset and enqueues a BullMQ processing job.
Workers process media from object storage and mark assets `ready` or `failed`.
The admin UI shows `processing`, `ready`, and `failed` states. Public pages serve
only `ready` media.

This removes deploy drain from the upload data path. A deploy or app host
failover may interrupt a short metadata/finalize request, but it must not corrupt
or lose the uploaded object. The client can retry finalize against whichever app
host is active.

## Upload pipeline

The upload pipeline has four durable stages:

1. **Create upload session**
   - Admin UI sends filename, size, content type, and intended usage.
   - App validates size/type policy and creates a DB row with status
     `uploading`.
   - App returns presigned object-storage upload instructions.
   - Small files can use a presigned PUT URL.
   - Large files and videos use multipart upload instructions.

2. **Browser uploads to object storage**
   - The browser sends bytes directly to R2/S3-compatible storage.
   - App hosts do not proxy the bytes.
   - Object keys are generated by the app and scoped by asset id, for example
     `media/raw/<assetId>/<safe-filename>`.

3. **Finalize upload**
   - Browser tells the app the upload completed.
   - App verifies the object exists and matches expected size/content metadata
     where the storage API supports it.
   - App changes DB status to `queued` and enqueues a BullMQ job with a stable
     job id based on the asset id.

4. **Worker processing**
   - Worker downloads or streams the raw object from object storage.
   - Worker validates MIME signature and policy.
   - Worker extracts metadata.
   - Worker creates required derivatives:
     - images: normalized image metadata and optional thumbnail;
     - files: metadata and safe download record;
     - videos: queued processing contract and future transcoding hook.
   - Worker writes derivatives back to object storage.
   - Worker marks the asset `ready`.
   - If processing fails after retries, worker marks the asset `failed` with a
     safe error code.

The request path is short and retryable. Heavy work happens in the worker.

## Admin media surface

The current production admin upload surface is:

- `src/components/mit-sailing/admin/catalog/AdminRichTextEditor.tsx`
- `src/components/mit-sailing/admin/catalog/AdminCmsMediaControls.tsx`
- `src/app/api/admin/cms-media/route.ts`
- `src/libs/mit-sailing/cmsMediaStorage.ts`

Those controls currently accept JPEG, PNG, WebP, and GIF images and write to
local CMS media storage. The target design replaces that storage path with the
object-storage upload pipeline.

Video support must use the same pipeline. Do not add video upload by increasing
local body size limits or proxying large request bodies through Next.js route
handlers.

`src/app/api/email-assets/route.ts` currently writes to container-local
`public/email-assets`. It is not production-persistent. Before relying on that
route in production admin workflows, either gate it to local/dev email preview
usage or migrate it to the object-storage pipeline.

## Deployment model

The deploy flow changes from single-host color switching to host-level
active/passive blue/green:

1. Build and push immutable image `sha-<short>`.
2. Deploy the image to the inactive app host.
3. Run migrations from the target image against external Postgres.
4. Start app and worker services on the inactive host.
5. Run health/readiness checks:
   - Next.js liveness;
   - protected readiness;
   - Postgres check;
   - Redis check;
   - object-storage connectivity check;
   - worker Redis health.
6. Shift Cloudflare Load Balancer traffic to the inactive host.
7. Keep the previous host running for rollback.
8. Restart or update worker placement according to the chosen worker policy.

Worker policy for the first implementation:

- Keep one active worker service to avoid duplicate processor surprises.
- Run it on the active app host or a separate worker host.
- Use stable BullMQ job ids and idempotent processors.
- Before allowing multiple workers, prove every processor is safe under
  concurrency.

## Rollback

Rollback shifts Cloudflare traffic back to the previous host/image after that
host passes readiness. Rollback does not reverse database migrations or object
storage writes.

To make rollback safe:

- migrations must be expand/contract;
- media DB rows and job payloads must be backward-compatible across at least one
  release;
- object keys must remain stable;
- old and new code must both tolerate `uploading`, `queued`, `processing`,
  `ready`, and `failed` media states.

## Redis, worker, and cron

Redis is production state because BullMQ jobs, retries, and schedulers live
there. It must be external to the app hosts for two-host deployment.

BullMQ schedules cron jobs automatically after a scheduler is registered in
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

Then recreate the worker with the pinned image and production worker env. The
exact command depends on whether workers run on the active app host or a separate
worker host, but it must include the deploy-owned image env file.

The cron string is six fields, seconds first. The default
`0 0 * * * *` runs at the top of each hour.

## Postgres and migrations

Production Postgres must be external to app hosts. It can be managed Postgres or
a self-managed database host with its own backup/failover plan. Do not run the
only production Postgres inside either app host if host-level resilience is a
requirement.

Deploy-time migrations run before traffic cutover. Because old and new app
versions overlap, migrations must follow expand/contract discipline:

- Add columns, tables, indexes, and enum values before new code depends on them.
- Deploy code that works against both previous and expanded schemas.
- Avoid same-release destructive drops, renames, and enum removals.
- Contract only after a later release proves old code no longer reads the old
  shape.

## Next.js self-hosting requirements

The app must keep `output: 'standalone'` and run `node server.js` in production.

`DEPLOYMENT_VERSION` must be set from the pinned SHA and passed to Next.js
`deploymentId` so clients can hard-navigate across version skew during
multi-instance deploys.

`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` must be set to one stable generated value
for production before overlapping app hosts are used.

The default Next.js cache is process-local. Any route whose correctness depends
on cross-host cache coherence must avoid process-local cache assumptions or use a
custom shared cache handler backed by Redis or another durable store.

Health and upload route handlers must run on the Node.js runtime. Do not use
Edge runtime for Prisma, Redis, or S3 SDK access.

## File permissions and local storage

The final two-host app design treats app hosts as stateless for uploaded media.
Local `/srv/mitsailing-data/cms-media` may remain only as a migration source or
temporary rollback aid until all production media has moved to object storage.

Any remaining local state on app hosts must be rebuildable from GitHub,
environment files, external Postgres, external Redis, and object storage.

## Error handling and recovery

- If object-storage upload session creation fails, no object upload begins.
- If browser upload succeeds but finalize fails, client can retry finalize.
- If finalize succeeds but worker processing fails, asset status becomes
  `failed`; raw object remains available for retry.
- If deploy readiness fails on the inactive host, traffic stays on the active
  host.
- If Cloudflare cutover fails, traffic stays on or returns to the active host.
- If worker update fails, web traffic can remain healthy while operators repair
  worker deployment; queued jobs remain in Redis.
- Rollback changes serving version only and must not delete object-storage media
  or reverse database migrations.

## Testing and verification

Add tests for:

- object-storage env validation;
- upload session creation policy;
- finalize idempotency;
- BullMQ enqueue job id stability;
- worker status transitions from `queued` to `processing` to `ready`/`failed`;
- rejection of unsupported MIME signatures;
- deploy/runbook contracts for two-host external storage requirements;
- health readiness including object-storage connectivity.

Run local verification after implementation:

- `npm run test`
- `npm run lint`
- `npm run check:types`
- `npm run check:deps`

Production verification before declaring enterprise zero downtime:

- Cloudflare health checks can route to either app host.
- A deploy can shift traffic from one host to the other with no failed health
  check.
- An admin can start a large image/file/video upload during deploy and complete
  it after traffic shifts.
- The uploaded asset reaches `ready` or `failed` deterministically.
- Killing one app host during upload does not lose the object; finalize is
  retryable on the surviving host.
- Cron remains disabled unless `.env.production.worker` explicitly sets
  `LEGACY_MYSQL_SYNC_ENABLED=true`.
