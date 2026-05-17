# Self-Hosted Upload Reliability Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven development or execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status (shipped):** Production `compose.prod.data.yaml` uses Compose service key `tusd` (not `upload-service` or `media-upload`). The custom `src/upload-service/**` tree and `build:upload-service` artifacts are removed.

**Goal:** Replace the custom single-request media upload service with pinned `tusd` + `tus-js-client`, then harden media processing and external readiness checks without replacing Redis or adding same-host monitoring; backup tooling is deferred to a follow-up.

**Architecture:** The app creates DB-backed media assets and signed tus upload metadata, the browser uploads bytes directly to `tusd` on the data/media host, and the app finalizes only after a tus `HEAD` proves the upload offset equals the expected length. The BullMQ worker treats the database as the source of truth by reconciling queued and stale processing assets on startup. Backup tooling is intentionally deferred until the team chooses a maintained restore-tested approach.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, BullMQ/Redis, Docker Compose, `tusproject/tusd:v2.9.2`, `tus-js-client@4.3.1`, Checkly.

---

## Current Context

- **Removed:** custom `upload-service` Compose key and `src/upload-service/**`; production upload is `tusd` (`tusproject/tusd:v2.9.2`) in `compose.prod.data.yaml`.
- Upload API: `src/app/api/admin/cms-media/uploads/route.ts` creates tus sessions via `src/libs/mit-sailing/cmsMediaUploadSessions.ts`.
- Finalize API: `src/app/api/admin/cms-media/uploads/[id]/finalize/route.ts` verifies tus completion before enqueueing.
- Worker: `src/worker/cmsMediaProcessingJob.ts` on Compose service `worker` moves `uploads/<assetId>` to `ready/<assetId>/<filename>` after MIME sniffing.
- Readiness: `src/libs/health/readiness.ts` checks `mediaUpload` with `OPTIONS /cms-media/uploads/` and `mediaPublic` with `GET /healthz`.
- Checkly: extend assertions for `mediaUpload` and `mediaPublic` when this plan’s monitoring tasks run.

## Version And Source Notes

- Pin Docker to `tusproject/tusd:v2.9.2`; Docker Hub publishes that tag and tusd releases are also published as Docker images.
- Pin npm to `tus-js-client@4.3.1`; `npm view tus-js-client version` returned `4.3.1` on 2026-05-17.
- `tusd` supports local `-upload-dir`, `-disable-download`, `-behind-proxy`, CORS flags, max-size, and HTTP hooks. Pre-create hook responses can reject uploads or set `ChangeFileInfo.ID` and `ChangeFileInfo.Storage.Path`.
- `tus-js-client` supports `endpoint`, `headers`, `metadata`, `uploadSize`, `retryDelays`, `removeFingerprintOnSuccess`, `findPreviousUploads()`, and `resumeFromPreviousUpload()`.
- Checkly `ApiCheck` supports `AssertionBuilder.jsonBody()` and environment variables in `checkly.config.ts`.

## Ownership Boundaries

### Deploy/Compose/Docs Worker

Owns:
- `compose.prod.data.yaml`
- `Dockerfile`
- `package.json`
- `package-lock.json`
- confirm `src/upload-service/**` stays deleted (no resurrection of `upload-service` Compose key)
- `src/libs/deploy/dockerComposeContract.test.ts`
- `src/libs/deploy/twoHostDeployScript.test.ts`
- `bin/deploy-two-host.sh`
- `docs/deploy.md`

Must not edit:
- App upload routes, worker job code, readiness code, Checkly config, admin client code.

### API/Worker Worker

Owns:
- `src/libs/mit-sailing/cmsMediaUploadSessions.ts`
- `src/libs/mit-sailing/cmsMediaUploadSessions.test.ts`
- `src/libs/mit-sailing/cmsMediaTusHooks.ts`
- `src/libs/mit-sailing/cmsMediaTusHooks.test.ts`
- `src/libs/mit-sailing/cmsMediaTusStatus.ts`
- `src/libs/mit-sailing/cmsMediaTusStatus.test.ts`
- `src/app/api/admin/cms-media/uploads/route.ts`
- `src/app/api/admin/cms-media/uploads/route.test.ts`
- `src/app/api/admin/cms-media/uploads/[id]/route.ts`
- `src/app/api/admin/cms-media/uploads/[id]/route.test.ts`
- `src/app/api/admin/cms-media/uploads/[id]/finalize/route.ts`
- `src/app/api/admin/cms-media/uploads/[id]/finalize/route.test.ts`
- `src/app/api/internal/cms-media/tusd/hooks/route.ts`
- `src/app/api/internal/cms-media/tusd/hooks/route.test.ts`
- `src/worker/cmsMediaProcessingJob.ts`
- `src/worker/cmsMediaProcessingJob.test.ts`
- `src/worker/index.ts`

Must not edit:
- Docker, package files, Checkly/readiness files, admin client components.

### Admin Client Worker

Owns:
- `src/components/mit-sailing/admin/catalog/cmsMediaTusUpload.ts`
- `src/components/mit-sailing/admin/catalog/cmsMediaTusUpload.test.ts`
- `src/components/mit-sailing/admin/catalog/AdminCmsMediaControls.tsx`
- `src/components/mit-sailing/admin/catalog/AdminCatalogRichText.test.tsx`

Must not edit:
- Upload API routes, worker job code, Docker/package files, readiness files.

### Readiness Worker

Owns:
- `src/libs/health/readiness.ts`
- `src/libs/health/readiness.test.ts`
- `src/app/api/health/ready/route.test.ts`
- `tests/e2e/Health.check.e2e.ts`
- `checkly.config.ts`
- `src/libs/health/checklyConfigContract.test.ts`

Must not edit:
- Upload API routes, worker job code, Docker/package files, admin client components.

Shared file rule:
- No worker has shared write ownership. `docs/deploy.md` belongs only to the Deploy/Compose/Docs worker. Backup tooling and backup docs are deferred and must not be added in this batch.

## External Interfaces

### Upload Session Response

`POST /api/admin/cms-media/uploads` must return:

```ts
{
  asset: CmsMediaUploadSessionAsset;
  upload: {
    protocol: 'tus';
    endpoint: string;
    headers: Record<string, string>;
    metadata: {
      assetId: string;
      byteSize: string;
      filename: string;
      filetype: string;
      token: string;
    };
    byteSize: number;
    expiresAt: string;
  };
}
```

The endpoint is `${MEDIA_UPLOAD_BASE_URL}/cms-media/uploads/` with a trailing slash. The upload token signs `assetId`, `byteSize`, `mimeType`, and `storedFilename`.

### tusd Hook Response

`POST /api/internal/cms-media/tusd/hooks` handles `pre-create`. For a valid asset/token/metadata/length it returns:

```json
{
  "ChangeFileInfo": {
    "ID": "asset-id",
    "Storage": {
      "Path": "asset-id"
    }
  }
}
```

For invalid input it returns a tusd hook response with `RejectUpload: true` and an HTTP response status of `400`, `401`, `403`, `404`, or `415`.

### Finalize Response

`POST /api/admin/cms-media/uploads/[id]/finalize` returns `409` with `{ "error": "upload_incomplete" }` until tus `HEAD ${MEDIA_UPLOAD_BASE_URL}/cms-media/uploads/${id}` reports:

- `Upload-Offset` equals the asset `byteSize`.
- `Upload-Length` equals the asset `byteSize`.

Only then may the route set status to `queued` and enqueue `cms-media-processing:<assetId>`.

## Task 1: Deploy/Compose/Docs Worker

> **Shipped:** Steps 1–6 below are complete in `main`. Keep contract tests and docs aligned with `tusd` / `worker`; do not reintroduce `upload-service`, `media-upload`, or `media-worker` Compose keys.

**Files:**
- Modify: `src/libs/deploy/dockerComposeContract.test.ts`
- Modify: `src/libs/deploy/twoHostDeployScript.test.ts`
- Modify: `compose.prod.data.yaml`
- Modify: `Dockerfile`
- Modify: `package.json`
- Modify: `package-lock.json`
- Deleted (keep absent): `src/upload-service/index.ts`, `server.ts`, `server.test.ts`
- Modify: `bin/deploy-two-host.sh`
- Modify: `docs/deploy.md`

- [ ] **Step 1: Write failing deploy contract tests**

Add expectations that `compose.prod.data.yaml` contains `tusd:` with `image: tusproject/tusd:v2.9.2`, binds `/srv/mitsailing-data/cms-media/uploads`, configures `-upload-dir=/srv/mitsailing-data/cms-media/uploads`, `-base-path=/cms-media/uploads/`, `-disable-download`, `-behind-proxy`, `-max-size=${MEDIA_UPLOAD_MAX_BYTES:-104857600}`, `-hooks-http=${TUSD_HOOKS_HTTP_URL:?set TUSD_HOOKS_HTTP_URL}`, CORS allow/expose tus headers, and no `upload-service:`.

Add expectations that `bin/deploy-two-host.sh` starts `tusd` only through a maintenance function, while normal `promote_ref` and `rollback_ref` restart only the worker.

Run:

```bash
npm run test -- src/libs/deploy/dockerComposeContract.test.ts src/libs/deploy/twoHostDeployScript.test.ts
```

Expected (pre-ship): fail when compose still ran `upload-service`. **Now:** PASS — see `compose.prod.data.yaml` service `tusd`.

- [x] **Step 2: Replace custom data service with pinned tusd**

Shipped in `compose.prod.data.yaml` as service `tusd`. Authoritative `command` list:

```yaml
command:
  - -upload-dir=/srv/mitsailing-data/cms-media/uploads
  - -base-path=/cms-media/uploads/
  - -disable-download
  - -behind-proxy
  - -max-size=${MEDIA_UPLOAD_MAX_BYTES:-104857600}
  - -hooks-http=${TUSD_HOOKS_HTTP_URL:?set TUSD_HOOKS_HTTP_URL}
  - -hooks-http-forward-headers=x-mitsailing-upload-token
  - -cors-allow-origin=${MEDIA_UPLOAD_CORS_ALLOW_ORIGIN:-https://mitsailing.com}
  - -cors-allow-headers=authorization,content-type,tus-resumable,upload-length,upload-metadata,upload-offset,x-mitsailing-upload-token
  - -cors-expose-headers=location,tus-resumable,upload-offset,upload-length,upload-metadata,upload-expires
```

Expose it on `${UPLOAD_SERVICE_BIND_HOST:-127.0.0.1}:${UPLOAD_SERVICE_PORT:-3001}:1080`. Keep Redis and Postgres unchanged.

- [x] **Step 3: Remove upload-service image build artifacts**

Removed `build:upload-service` from `package.json`, removed upload-service build/copy from `Dockerfile`.

Run:

```bash
npm install tus-js-client@4.3.1 --save-exact
```

Expected: `package.json` and `package-lock.json` include exact `tus-js-client` and no `build:upload-service` script remains.

- [x] **Step 4: Delete custom upload service source and tests**

Deleted `src/upload-service/**`. Confirm `rg "upload-service:|build:upload-service|upload-service.mjs" package.json Dockerfile src compose.prod.data.yaml` returns no matches (plans may mention retired keys).

- [x] **Step 5: Protect tusd from normal app deploy restarts**

Add a `restart_tusd_maintenance()` function to `bin/deploy-two-host.sh` that runs only when explicitly requested by an operator command such as `tusd-maintenance <ref>`. Normal `release`, `promote_ref`, and `rollback_ref` must keep using `restart_data_worker` only.

- [x] **Step 6: Update deploy docs**

`docs/deploy.md` documents `tusd` and the rule: app deploys and rollbacks recreate app hosts plus `worker` only; `tusd` upgrades use explicit maintenance because active uploads can be disrupted.

- [ ] **Step 7: Run deploy tests**

Run:

```bash
npm run test -- src/libs/deploy/dockerComposeContract.test.ts src/libs/deploy/twoHostDeployScript.test.ts
```

Expected: pass.

## Task 2: API/Worker Worker

**Files:**
- Modify/create the API/Worker-owned files listed above.

- [ ] **Step 1: Write failing upload-session contract tests**

In `src/libs/mit-sailing/cmsMediaUploadSessions.test.ts`, change the existing PUT expectations to tus expectations:

```ts
expect(session.upload.protocol).toBe('tus');
expect(session.upload.endpoint).toBe(
  'https://uploads.mitsailing.com/cms-media/uploads/'
);
expect(session.upload.metadata.assetId).toBe('asset-1');
expect(session.upload.metadata.byteSize).toBe('1024');
expect(session.upload.metadata.filetype).toBe('image/png');
expect(session.upload.byteSize).toBe(1024);
```

Verify the token from `session.upload.metadata.token`.

Run:

```bash
npm run test -- src/libs/mit-sailing/cmsMediaUploadSessions.test.ts
```

Expected: fail because the current code returns `method: "PUT"` and `url`.

- [ ] **Step 2: Implement tus upload session helpers**

Update `src/libs/mit-sailing/cmsMediaUploadSessions.ts` with `buildCmsMediaTusEndpoint()` and `createCmsMediaUploadSession()` returning the tus contract. Do not return production `method: "PUT"` or `url`.

- [ ] **Step 3: Write failing tus hook tests**

Create `src/libs/mit-sailing/cmsMediaTusHooks.test.ts`. Cover:

- valid `pre-create` returns `ChangeFileInfo.ID` and `Storage.Path` equal to the asset id;
- missing token rejects with `401`;
- token for a different asset rejects with `403`;
- upload length different from DB byte size rejects with `400`;
- MIME metadata mismatch rejects with `415`;
- missing DB asset rejects with `404`.

Run:

```bash
npm run test -- src/libs/mit-sailing/cmsMediaTusHooks.test.ts
```

Expected: fail because the helper does not exist.

- [ ] **Step 4: Implement tus hook helper and route**

Create `src/libs/mit-sailing/cmsMediaTusHooks.ts` with narrow parsing for tusd hook JSON. Create `src/app/api/internal/cms-media/tusd/hooks/route.ts` that calls the helper and returns the JSON response. Use `Env.MEDIA_UPLOAD_SHARED_SECRET`, `prisma.cmsMediaAsset.findUnique`, and token verification. The route is `runtime = 'nodejs'`.

- [ ] **Step 5: Write failing finalize tus status tests**

Create `src/libs/mit-sailing/cmsMediaTusStatus.test.ts` and route tests for finalize. Cover complete, incomplete offset, missing headers, `404`, and fetch failure.

Run:

```bash
npm run test -- src/libs/mit-sailing/cmsMediaTusStatus.test.ts 'src/app/api/admin/cms-media/uploads/[id]/finalize/route.test.ts'
```

Expected: fail because finalize does not call tus `HEAD`.

- [ ] **Step 6: Implement finalize verification**

Create `src/libs/mit-sailing/cmsMediaTusStatus.ts` with a function that sends a bounded `HEAD` request to `${MEDIA_UPLOAD_BASE_URL}/cms-media/uploads/${assetId}` and returns complete only when `Upload-Offset` and `Upload-Length` equal the expected byte size. Update finalize to return `409 upload_incomplete` until complete.

- [ ] **Step 7: Add upload cancel/read route tests if needed by client resume**

Extend `src/app/api/admin/cms-media/uploads/[id]/route.ts` with a narrow admin-only `DELETE` that marks a still-`uploading` asset as `failed` with `processingErrorCode: "upload_cancelled"`. This supports the client when it resumes an earlier tus upload after a browser refresh and cancels the new unused session.

- [ ] **Step 8: Write failing worker byte-size and reconciliation tests**

Extend `src/worker/cmsMediaProcessingJob.test.ts`:

- raw file size smaller or larger than `asset.byteSize` marks `byte_size_mismatch`;
- `reconcileCmsMediaProcessingJobs(queue, now)` enqueues all `queued` server-folder assets;
- stale `processing` assets with `updatedAt` older than 15 minutes are re-enqueued;
- recent `processing`, `uploading`, `ready`, and local assets are not re-enqueued.

Run:

```bash
npm run test -- src/worker/cmsMediaProcessingJob.test.ts
```

Expected: fail because current processing does not select `byteSize` and there is no reconciliation helper.

- [ ] **Step 9: Implement worker hardening**

Select `byteSize` and `updatedAt` for media assets, compare `stat(rawPath).size` before reading headers, mark mismatch as failed, and export `reconcileCmsMediaProcessingJobs()`. In `src/worker/index.ts`, call reconciliation after queue creation and before worker construction.

- [ ] **Step 10: Run API/worker tests**

Run:

```bash
npm run test -- src/libs/mit-sailing/cmsMediaUploadSessions.test.ts src/libs/mit-sailing/cmsMediaTusHooks.test.ts src/libs/mit-sailing/cmsMediaTusStatus.test.ts src/worker/cmsMediaProcessingJob.test.ts 'src/app/api/admin/cms-media/uploads/[id]/finalize/route.test.ts'
```

Expected: pass.

## Task 3: Admin Client Worker

**Files:**
- Create: `src/components/mit-sailing/admin/catalog/cmsMediaTusUpload.ts`
- Create: `src/components/mit-sailing/admin/catalog/cmsMediaTusUpload.test.ts`
- Modify: `src/components/mit-sailing/admin/catalog/AdminCmsMediaControls.tsx`
- Modify: `src/components/mit-sailing/admin/catalog/AdminCatalogRichText.test.tsx`

- [ ] **Step 1: Write failing tus client wrapper tests**

Mock `tus-js-client` and assert the wrapper creates `new tus.Upload(file, { endpoint, headers, metadata, uploadSize, retryDelays, removeFingerprintOnSuccess, onError, onSuccess })`, calls `findPreviousUploads()`, resumes the newest previous upload when present, and resolves only after success.

Run:

```bash
npm run test -- src/components/mit-sailing/admin/catalog/cmsMediaTusUpload.test.ts
```

Expected: fail because the wrapper does not exist.

- [ ] **Step 2: Implement tus client wrapper**

Use named exports only. The wrapper accepts `{ file, session, onProgress? }` and returns a promise. It must call `upload.start()`, reject on `onError`, resolve on `onSuccess`, and use retry delays `[0, 3000, 5000, 10000, 20000]`.

- [ ] **Step 3: Write failing AdminCmsMediaControls tests**

In the existing rich text/media tests, update upload-session mocks to return the tus contract and assert no direct `fetch(session.upload.url, { method: "PUT" })` occurs. Assert finalize is called after the tus wrapper resolves.

Run:

```bash
npm run test -- src/components/mit-sailing/admin/catalog/cmsMediaTusUpload.test.ts src/components/mit-sailing/admin/catalog/AdminCatalogRichText.test.tsx
```

Expected: fail until `AdminCmsMediaControls.tsx` uses the wrapper.

- [ ] **Step 4: Update admin upload flow**

Change `uploadDetailsFromUnknown()` to parse the tus contract, call the tus wrapper for `protocol: "tus"`, keep direct `/api/admin/cms-media` fallback only when upload-session creation returns `404` or `503`, and finalize the asset returned by the session or previous resume metadata.

- [ ] **Step 5: Run admin client tests**

Run:

```bash
npm run test -- src/components/mit-sailing/admin/catalog/cmsMediaTusUpload.test.ts src/components/mit-sailing/admin/catalog/AdminCatalogRichText.test.tsx
```

Expected: pass.

## Task 4: Readiness Worker

**Files:**
- Modify/create the Readiness-owned files listed above.

- [ ] **Step 1: Write failing readiness tests**

Update `src/libs/health/readiness.test.ts` to expect the media upload check to call:

```ts
expect(httpCheck).toHaveBeenCalledWith(
  'https://uploads.mitsailing.com/cms-media/uploads/',
  31,
  expect.objectContaining({ method: 'OPTIONS' })
);
```

If the helper remains two-argument, first add the failing assertion for the URL path and method by extending the checker type in the test.

Run:

```bash
npm run test -- src/libs/health/readiness.test.ts
```

Expected: fail because readiness still calls `/api/health/live`.

- [ ] **Step 2: Implement tus-compatible readiness probe**

Change `checkHttp` and the checker type to accept `{ method?: 'GET' | 'OPTIONS' }`. Probe `mediaUpload` with `OPTIONS /cms-media/uploads/` and keep `mediaPublic` on `GET /healthz`.

- [ ] **Step 3: Write failing Checkly contract test**

Create `src/libs/health/checklyConfigContract.test.ts` that imports `checkly.config.ts` and asserts the ready check includes:

```ts
AssertionBuilder.jsonBody('$.checks.mediaUpload.status').equals('ok')
AssertionBuilder.jsonBody('$.checks.mediaPublic.status').equals('ok')
```

Run:

```bash
npm run test -- src/libs/health/checklyConfigContract.test.ts
```

Expected: fail because Checkly currently asserts only postgres and redis.

- [ ] **Step 4: Update Checkly and e2e readiness assertions**

Add Checkly assertions for `mediaUpload` and `mediaPublic`. Update `tests/e2e/Health.check.e2e.ts` to assert protected readiness includes `postgres`, `redis`, `mediaUpload`, and `mediaPublic`.

- [ ] **Step 5: Keep backup tooling deferred**

Do not add backup tooling, backup config files, or backup docs in this batch. Do not add BorgBackup, pgBackRest, restic, Uptime Kuma, or any same-host monitoring service.

- [ ] **Step 6: Run readiness tests**

Run:

```bash
npm run test -- src/libs/health/readiness.test.ts src/libs/health/checklyConfigContract.test.ts src/app/api/health/ready/route.test.ts
```

Expected: pass.

## Main Integration Checklist

- [ ] Review Deploy/Compose/Docs worker changed paths and ensure no non-owned files were edited.
- [ ] Run deploy contract tests after integrating Deploy worker.
- [ ] Review API/Worker worker changed paths and ensure no non-owned files were edited.
- [ ] Run API/worker targeted tests after integrating API worker.
- [ ] Review Admin Client worker changed paths and ensure no non-owned files were edited.
- [ ] Run admin client targeted tests after integrating Admin worker.
- [ ] Review Backup/Readiness worker changed paths and ensure no non-owned files were edited.
- [ ] Run readiness targeted tests after integrating Backup worker.
- [ ] Run `npm run lint`.
- [ ] Run `npm run check:types`.
- [ ] Run `npm run test`.

## Acceptance Notes

- Redis remains in Compose and BullMQ remains the queue.
- Uptime Kuma is not added.
- Checkly asserts `mediaUpload` and `mediaPublic` readiness.
- Protected readiness reports `postgres`, `redis`, `mediaPublic`, and `mediaUpload`.
- Normal app deploy and rollback paths do not recreate `tusd`.
- Backup tooling is not implemented in this batch; it remains an explicit follow-up decision.
