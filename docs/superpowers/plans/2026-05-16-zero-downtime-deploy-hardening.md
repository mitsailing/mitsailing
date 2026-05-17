# Zero-downtime Docker Media and Deploy Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Docker-only production path where merged PR deploys preserve web availability and admin image, file, and video uploads while uploaded files stay on our own server folder.

**Architecture:** Run two stateless headless app hosts behind Cloudflare Load Balancing or an equivalent health-checking proxy. Run a separate Docker data/media server for Postgres, Redis, resumable media upload, media processing, and media serving; all durable state lives under `/srv/mitsailing-data`. Browser uploads go directly to the Dockerized media upload service, then the app finalizes the upload and BullMQ processes the file from the shared media folder.

**Tech Stack:** Next.js 16 standalone output, TypeScript, Prisma/Postgres, Redis/BullMQ, Docker Compose v2, Cloudflare Load Balancing or Dockerized proxy, Dockerized `tusd` resumable uploads, nginx static media serving, Vitest, Playwright, t3-env.

---

## Scope

This plan replaces app-host-local CMS media writes with a data/media-server folder pipeline. It does not add R2, S3, MinIO, or another S3-compatible service. The app hosts remain stateless for media; the data/media server owns the media folder.

The data/media server is still a single point of failure for Postgres, Redis, and media in this phase. This meets the app deploy zero-downtime requirement and app-host failover requirement, but it does not make the database/media tier highly available.

## File Structure

- Modify `prisma/schema.prisma`: add CMS media status, kind, storage provider, raw upload id/path, ready path, thumbnail path, processing error, metadata, and processed timestamp.
- Create `prisma/migrations/<timestamp>_durable_cms_media/migration.sql`: add non-destructive media fields and indexes.
- Modify `src/libs/Env.ts` and `src/libs/Env.test.ts`: validate data/media server URLs, local storage root, traffic gate, Redis, Postgres, and stable Server Actions key.
- Modify `.env.production.example`: point production app hosts to external Docker Postgres/Redis and media endpoints.
- Create `.env.production.data.example`: data/media server env for Docker Postgres, Redis, upload service, media server, and worker.
- Create `src/libs/mit-sailing/cmsMediaTypes.ts`: shared status, kind, upload-session, and upload-result types.
- Modify `src/libs/mit-sailing/cmsMediaValidation.ts` and tests: support image, file, and video upload policy.
- Create `src/libs/mit-sailing/cmsMediaFileStorage.ts` and tests: root-contained paths under `/srv/mitsailing-data/cms-media`, tus upload path validation, ready-file paths, and URL mapping.
- Create `src/libs/mit-sailing/cmsMediaUploadSessions.ts` and tests: create upload sessions, finalize completed tus uploads, enqueue BullMQ jobs with stable ids.
- Create `src/app/api/admin/cms-media/uploads/route.ts`: admin upload-session creation.
- Create `src/app/api/admin/cms-media/uploads/[id]/route.ts`: admin upload status.
- Create `src/app/api/admin/cms-media/uploads/[id]/finalize/route.ts`: admin finalize route.
- Modify `src/app/api/admin/cms-media/route.ts`: list durable assets and disable direct multipart POST in staging/production.
- Modify `src/app/cms-media/[id]/[filename]/route.ts`: serve only ready media, redirecting to the Docker media server URL.
- Create `src/worker/cmsMediaProcessingJob.ts` and tests: idempotent BullMQ processing from raw upload file to ready file.
- Modify `src/worker/index.ts`: dispatch the CMS media processing job.
- Modify `src/components/mit-sailing/admin/catalog/AdminCmsMediaControls.tsx` and tests: upload with `tus-js-client`, finalize, poll status, and show failed/processing states.
- Modify `src/components/mit-sailing/admin/catalog/AdminRichTextEditor.tsx` and tests: keep rich-text insertion image-only and ready-only.
- Create `src/components/mit-sailing/admin/media/AdminMediaLibrary.tsx` and tests: image/file/video media library.
- Create `src/app/[locale]/(marketing)/(site)/admin/media/page.tsx`: authenticated admin media page.
- Modify `src/locales/en.json`: add admin media status labels and errors.
- Modify `src/libs/health/readiness.ts`, tests, and `/api/health/ready`: include Postgres, Redis, media upload service, media server, and `HOST_TRAFFIC_ENABLED`.
- Create `compose.prod.data.yaml`: Dockerized Postgres, Redis, tusd upload service, media worker, and media-serving nginx.
- Create `compose.prod.app-host.yaml`: Dockerized stateless web, optional worker, and cloudflared/proxy connector per app host.
- Modify `compose.prod.yaml`: mark the existing single-host overlay as legacy.
- Create `bin/deploy-two-host.sh`: deploy inactive app host, migrate once, promote, demote, rollback.
- Modify `docs/deploy.md`: document Docker data/media server, two app hosts, cron enablement, rollback limits, and upload rehearsal.
- Create `tests/e2e/admin-media-upload.e2e.ts`: verify admin media upload through the server-folder pipeline.

## Phase 1: Durable Media Schema

### Task 1: Add CMS Media Persistence Contract

**Files:**
- Create: `src/libs/mit-sailing/cmsMediaAssetContract.test.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_durable_cms_media/migration.sql`

- [ ] **Step 1: Write the failing schema contract test**

Create `src/libs/mit-sailing/cmsMediaAssetContract.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('durable CMS media schema contract', () => {
  const schema = readRepoFile('prisma/schema.prisma');

  it('models upload status and media kind for queued processing', () => {
    expect(schema).toContain('enum CmsMediaStatus');
    expect(schema).toContain('uploading');
    expect(schema).toContain('queued');
    expect(schema).toContain('processing');
    expect(schema).toContain('ready');
    expect(schema).toContain('failed');
    expect(schema).toContain('enum CmsMediaKind');
    expect(schema).toContain('image');
    expect(schema).toContain('file');
    expect(schema).toContain('video');
  });

  it('stores server-folder upload and ready-file paths', () => {
    expect(schema).toContain('enum CmsMediaStorageProvider');
    expect(schema).toContain('server_folder');
    expect(schema).toContain('storageProvider');
    expect(schema).toContain('rawUploadId');
    expect(schema).toContain('rawFilePath');
    expect(schema).toContain('readyFilePath');
    expect(schema).toContain('thumbnailFilePath');
    expect(schema).toContain('processingErrorCode');
    expect(schema).toContain('processedAt');
    expect(schema).toContain('metadata');
    expect(schema).toContain('publicPath       String   @unique');
  });
});
```

- [ ] **Step 2: Run the schema contract test and verify failure**

Run:

```bash
npm run test -- --run src/libs/mit-sailing/cmsMediaAssetContract.test.ts
```

Expected: FAIL because the schema does not have durable upload status, kind, or server-folder path fields.

- [ ] **Step 3: Extend the Prisma schema**

In `prisma/schema.prisma`, add these enums near the CMS enums:

```prisma
enum CmsMediaStatus {
  uploading
  queued
  processing
  ready
  failed

  @@map("cms_media_status")
}

enum CmsMediaKind {
  image
  file
  video

  @@map("cms_media_kind")
}

enum CmsMediaStorageProvider {
  local
  server_folder

  @@map("cms_media_storage_provider")
}
```

Update `model CmsMediaAsset`:

```prisma
model CmsMediaAsset {
  id                  String                  @id @default(cuid())
  pageId              String?                 @map("page_id")
  storedFilename      String                  @map("stored_filename")
  originalFilename    String                  @map("original_filename")
  mimeType            String                  @map("mime_type")
  byteSize            Int                     @map("byte_size")
  publicPath          String                  @unique @map("public_path")
  uploadedByUserId    String?                 @map("uploaded_by_user_id")
  status              CmsMediaStatus          @default(ready)
  mediaKind           CmsMediaKind            @default(image) @map("media_kind")
  storageProvider     CmsMediaStorageProvider @default(local) @map("storage_provider")
  rawUploadId         String?                 @map("raw_upload_id")
  rawFilePath         String?                 @map("raw_file_path")
  readyFilePath       String?                 @map("ready_file_path")
  thumbnailFilePath   String?                 @map("thumbnail_file_path")
  processingErrorCode String?                 @map("processing_error_code")
  metadata            Json?
  processedAt         DateTime?               @map("processed_at")
  createdAt           DateTime                @default(now()) @map("created_at")
  updatedAt           DateTime                @updatedAt @map("updated_at")

  page       CmsPage? @relation(fields: [pageId], references: [id], onDelete: SetNull)
  uploadedBy User?    @relation("CmsMediaUploadedBy", fields: [uploadedByUserId], references: [id], onDelete: SetNull)

  @@index([pageId, createdAt])
  @@index([uploadedByUserId])
  @@index([status, createdAt])
  @@index([storageProvider, status])
  @@index([rawUploadId])
  @@map("cms_media_assets")
}
```

- [ ] **Step 4: Add the non-destructive SQL migration**

Create `prisma/migrations/<timestamp>_durable_cms_media/migration.sql`:

```sql
CREATE TYPE "cms_media_status" AS ENUM ('uploading', 'queued', 'processing', 'ready', 'failed');
CREATE TYPE "cms_media_kind" AS ENUM ('image', 'file', 'video');
CREATE TYPE "cms_media_storage_provider" AS ENUM ('local', 'server_folder');

ALTER TABLE "cms_media_assets"
  ADD COLUMN "status" "cms_media_status" NOT NULL DEFAULT 'ready',
  ADD COLUMN "media_kind" "cms_media_kind" NOT NULL DEFAULT 'image',
  ADD COLUMN "storage_provider" "cms_media_storage_provider" NOT NULL DEFAULT 'local',
  ADD COLUMN "raw_upload_id" TEXT,
  ADD COLUMN "raw_file_path" TEXT,
  ADD COLUMN "ready_file_path" TEXT,
  ADD COLUMN "thumbnail_file_path" TEXT,
  ADD COLUMN "processing_error_code" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "processed_at" TIMESTAMPTZ;

UPDATE "cms_media_assets"
SET "processed_at" = "created_at"
WHERE "processed_at" IS NULL AND "status" = 'ready';

CREATE INDEX "cms_media_assets_status_created_at_idx"
  ON "cms_media_assets"("status", "created_at");

CREATE INDEX "cms_media_assets_storage_provider_status_idx"
  ON "cms_media_assets"("storage_provider", "status");

CREATE INDEX "cms_media_assets_raw_upload_id_idx"
  ON "cms_media_assets"("raw_upload_id");
```

- [ ] **Step 5: Generate Prisma client and run focused checks**

Run:

```bash
npm run check:types
npm run test -- --run src/libs/mit-sailing/cmsMediaAssetContract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the persistence contract**

Run:

```bash
git add prisma/schema.prisma prisma/migrations src/generated src/libs/mit-sailing/cmsMediaAssetContract.test.ts
git commit -m "feat: add durable cms media schema"
```

### Task 2: Add Media Type and Upload Policy Validation

**Files:**
- Create: `src/libs/mit-sailing/cmsMediaTypes.ts`
- Modify: `src/libs/mit-sailing/cmsMediaValidation.ts`
- Modify: `src/libs/mit-sailing/cmsMediaValidation.test.ts`

- [ ] **Step 1: Write failing validation tests**

Add to `src/libs/mit-sailing/cmsMediaValidation.test.ts`:

```ts
import {
  detectCmsMediaKind,
  mediaKindFromMimeType,
  validateCmsMediaMetadata,
} from '@/libs/mit-sailing/cmsMediaValidation';

describe('durable cms media validation', () => {
  it('classifies image, file, and video mime types', () => {
    expect(mediaKindFromMimeType('image/png')).toBe('image');
    expect(mediaKindFromMimeType('application/pdf')).toBe('file');
    expect(mediaKindFromMimeType('video/mp4')).toBe('video');
    expect(mediaKindFromMimeType('application/x-msdownload')).toBeNull();
  });

  it('validates upload metadata before opening a server-folder upload', () => {
    expect(
      validateCmsMediaMetadata({
        byteSize: 1024,
        declaredMimeType: 'application/pdf',
        originalFilename: 'sailing-handbook.pdf',
      })
    ).toEqual({
      ok: true,
      mediaKind: 'file',
      mimeType: 'application/pdf',
      storedFilename: 'sailing-handbook.pdf',
    });
  });

  it('detects common video signatures during worker processing', () => {
    const mp4Bytes = new Uint8Array([
      0, 0, 0, 24, 102, 116, 121, 112, 109, 112, 52, 50,
    ]);

    expect(detectCmsMediaKind(mp4Bytes, 'video/mp4')).toBe('video');
  });
});
```

- [ ] **Step 2: Run validation tests and verify failure**

Run:

```bash
npm run test -- --run src/libs/mit-sailing/cmsMediaValidation.test.ts
```

Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Add shared media types**

Create `src/libs/mit-sailing/cmsMediaTypes.ts`:

```ts
export const CMS_MEDIA_STATUSES = [
  'uploading',
  'queued',
  'processing',
  'ready',
  'failed',
] as const;

export type CmsMediaStatus = (typeof CMS_MEDIA_STATUSES)[number];

export const CMS_MEDIA_KINDS = ['image', 'file', 'video'] as const;

export type CmsMediaKind = (typeof CMS_MEDIA_KINDS)[number];

export type CmsMediaUploadSession = {
  asset: {
    createdAt: string;
    id: string;
    mediaKind: CmsMediaKind;
    originalFilename: string;
    publicPath: string;
    status: 'uploading';
  };
  upload: {
    endpoint: string;
    headers: Record<string, string>;
    metadata: Record<string, string>;
  };
};
```

- [ ] **Step 4: Extend validation**

In `src/libs/mit-sailing/cmsMediaValidation.ts`, add file/video policies:

```ts
import type { CmsMediaKind } from '@/libs/mit-sailing/cmsMediaTypes';

export const CMS_MEDIA_MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const CMS_MEDIA_MAX_FILE_BYTES = 100 * 1024 * 1024;
export const CMS_MEDIA_MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

export const CMS_MEDIA_ALLOWED_FILE_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

export const CMS_MEDIA_ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;
```

Add:

```ts
export function mediaKindFromMimeType(mimeType: string): CmsMediaKind | null {
  if (ALLOWED_MIME_TYPE_SET.has(mimeType)) {
    return 'image';
  }
  if (CMS_MEDIA_ALLOWED_FILE_MIME_TYPES.includes(mimeType as never)) {
    return 'file';
  }
  if (CMS_MEDIA_ALLOWED_VIDEO_MIME_TYPES.includes(mimeType as never)) {
    return 'video';
  }
  return null;
}

function mediaMaxBytes(kind: CmsMediaKind): number {
  if (kind === 'image') {
    return CMS_MEDIA_MAX_IMAGE_BYTES;
  }
  if (kind === 'video') {
    return CMS_MEDIA_MAX_VIDEO_BYTES;
  }
  return CMS_MEDIA_MAX_FILE_BYTES;
}

export function validateCmsMediaMetadata(props: {
  byteSize: number;
  declaredMimeType: string;
  originalFilename: string;
}):
  | {
      ok: true;
      mediaKind: CmsMediaKind;
      mimeType: string;
      storedFilename: string;
    }
  | { ok: false; code: CmsMediaValidationErrorCode } {
  if (props.byteSize <= 0) {
    return { ok: false, code: 'empty_file' };
  }
  const mediaKind = mediaKindFromMimeType(props.declaredMimeType);
  if (!mediaKind) {
    return { ok: false, code: 'unsupported_type' };
  }
  if (props.byteSize > mediaMaxBytes(mediaKind)) {
    return { ok: false, code: 'too_large' };
  }
  return {
    ok: true,
    mediaKind,
    mimeType: props.declaredMimeType,
    storedFilename: sanitizeCmsMediaFilenameForKind({
      mediaKind,
      mimeType: props.declaredMimeType,
      originalFilename: props.originalFilename,
    }),
  };
}
```

Keep the existing image byte validation for local compatibility and worker image signature checks.

- [ ] **Step 5: Run validation checks**

Run:

```bash
npm run test -- --run src/libs/mit-sailing/cmsMediaValidation.test.ts
npm run check:types
```

Expected: PASS.

- [ ] **Step 6: Commit validation**

Run:

```bash
git add src/libs/mit-sailing/cmsMediaTypes.ts src/libs/mit-sailing/cmsMediaValidation.ts src/libs/mit-sailing/cmsMediaValidation.test.ts
git commit -m "feat: validate cms media upload metadata"
```

## Phase 2: Server-folder Upload Pipeline

### Task 3: Add Data/media Server Env Validation

**Files:**
- Modify: `src/libs/Env.ts`
- Modify: `src/libs/Env.test.ts`
- Modify: `.env.production.example`
- Create: `.env.production.data.example`

- [ ] **Step 1: Write failing env tests**

Add to `src/libs/Env.test.ts`:

```ts
  it('requires media server settings in production', async () => {
    stubRequiredBaseEnv();
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('REDIS_URL', 'redis://10.0.0.10:6379');
    vi.stubEnv('HEALTHCHECK_SECRET', 'x'.repeat(32));
    vi.stubEnv('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY', 'x'.repeat(32));

    await expect(import('@/libs/Env')).rejects.toThrow(
      'MEDIA_UPLOAD_BASE_URL is required in staging and production.'
    );
  });

  it('accepts private docker data server endpoints', async () => {
    stubRequiredBaseEnv();
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('REDIS_URL', 'redis://10.0.0.10:6379');
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://mitsailing:secret@10.0.0.10:5432/mitsailing_prod?schema=public'
    );
    vi.stubEnv('HEALTHCHECK_SECRET', 'x'.repeat(32));
    vi.stubEnv('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY', 'x'.repeat(32));
    vi.stubEnv('MEDIA_UPLOAD_BASE_URL', 'https://uploads.mitsailing.com');
    vi.stubEnv('MEDIA_PUBLIC_BASE_URL', 'https://media.mitsailing.com');
    vi.stubEnv('MEDIA_STORAGE_ROOT', '/srv/mitsailing-data/cms-media');
    vi.stubEnv('HOST_TRAFFIC_ENABLED', 'false');

    const { Env } = await import('@/libs/Env');

    expect(Env.MEDIA_UPLOAD_BASE_URL).toBe('https://uploads.mitsailing.com');
    expect(Env.MEDIA_STORAGE_ROOT).toBe('/srv/mitsailing-data/cms-media');
    expect(Env.HOST_TRAFFIC_ENABLED).toBe('false');
  });
```

- [ ] **Step 2: Run env tests and verify failure**

Run:

```bash
npm run test -- --run src/libs/Env.test.ts
```

Expected: FAIL because the media server env keys are not defined.

- [ ] **Step 3: Add env schema**

In `src/libs/Env.ts`, add server fields:

```ts
    HOST_COLOR: z.enum(['blue', 'green']).optional(),
    HOST_TRAFFIC_ENABLED: z.enum(['true', 'false']).default('true'),
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: z.string().min(32).optional(),
    MEDIA_UPLOAD_BASE_URL: z.url().optional(),
    MEDIA_PUBLIC_BASE_URL: z.url().optional(),
    MEDIA_STORAGE_ROOT: z.string().min(1).default('local/cms-media'),
    MEDIA_UPLOAD_SHARED_SECRET: z.string().min(32).optional(),
```

Add matching `runtimeEnv` entries. In `createFinalSchema`, add:

```ts
      if (
        (env.APP_ENV === 'staging' || env.APP_ENV === 'production') &&
        !env.MEDIA_UPLOAD_BASE_URL
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'MEDIA_UPLOAD_BASE_URL is required in staging and production.',
          path: ['MEDIA_UPLOAD_BASE_URL'],
        });
      }
      if (
        (env.APP_ENV === 'staging' || env.APP_ENV === 'production') &&
        !env.MEDIA_PUBLIC_BASE_URL
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'MEDIA_PUBLIC_BASE_URL is required in staging and production.',
          path: ['MEDIA_PUBLIC_BASE_URL'],
        });
      }
      if (
        (env.APP_ENV === 'staging' || env.APP_ENV === 'production') &&
        !env.MEDIA_STORAGE_ROOT.startsWith('/')
      ) {
        ctx.addIssue({
          code: 'custom',
          message:
            'MEDIA_STORAGE_ROOT must be an absolute path in staging and production.',
          path: ['MEDIA_STORAGE_ROOT'],
        });
      }
      if (
        (env.APP_ENV === 'staging' || env.APP_ENV === 'production') &&
        !env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
      ) {
        ctx.addIssue({
          code: 'custom',
          message:
            'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is required in staging and production.',
          path: ['NEXT_SERVER_ACTIONS_ENCRYPTION_KEY'],
        });
      }
```

- [ ] **Step 4: Update env examples**

In `.env.production.example`, document app-host env:

```dotenv
APP_ENV=production
HOST_COLOR=
HOST_TRAFFIC_ENABLED=false
DATABASE_URL=postgresql://mitsailing:PASSWORD@DATA_SERVER_PRIVATE_IP:5432/mitsailing_prod?schema=public
REDIS_URL=redis://DATA_SERVER_PRIVATE_IP:6379
HEALTHCHECK_SECRET=
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=
MEDIA_UPLOAD_BASE_URL=https://uploads.mitsailing.com
MEDIA_PUBLIC_BASE_URL=https://media.mitsailing.com
MEDIA_STORAGE_ROOT=/srv/mitsailing-data/cms-media
MEDIA_UPLOAD_SHARED_SECRET=
LEGACY_MYSQL_SYNC_ENABLED=false
```

Create `.env.production.data.example`:

```dotenv
POSTGRES_DB=mitsailing_prod
POSTGRES_USER=mitsailing
POSTGRES_PASSWORD=
REDIS_URL=redis://redis:6379
DATABASE_URL=postgresql://mitsailing:PASSWORD@postgres:5432/mitsailing_prod?schema=public
MEDIA_STORAGE_ROOT=/srv/mitsailing-data/cms-media
MEDIA_UPLOAD_BASE_URL=https://uploads.mitsailing.com
MEDIA_PUBLIC_BASE_URL=https://media.mitsailing.com
MEDIA_UPLOAD_SHARED_SECRET=
LEGACY_MYSQL_SYNC_ENABLED=false
```

- [ ] **Step 5: Run env checks**

Run:

```bash
npm run test -- --run src/libs/Env.test.ts
npm run check:types
```

Expected: PASS.

- [ ] **Step 6: Commit env validation**

Run:

```bash
git add src/libs/Env.ts src/libs/Env.test.ts .env.production.example .env.production.data.example
git commit -m "feat: configure docker media server env"
```

### Task 4: Add Server-folder Storage Helpers

**Files:**
- Create: `src/libs/mit-sailing/cmsMediaFileStorage.ts`
- Create: `src/libs/mit-sailing/cmsMediaFileStorage.test.ts`

- [ ] **Step 1: Write failing storage helper tests**

Create `src/libs/mit-sailing/cmsMediaFileStorage.test.ts`:

```ts
import {
  buildCmsMediaReadyPath,
  buildCmsMediaReadyUrl,
  resolveTusUploadFilePath,
} from '@/libs/mit-sailing/cmsMediaFileStorage';

describe('cms media server-folder storage', () => {
  const root = '/srv/mitsailing-data/cms-media';

  it('builds root-contained ready paths', () => {
    expect(
      buildCmsMediaReadyPath({
        assetId: 'asset-1',
        filename: 'race-day.jpg',
        root,
      })
    ).toBe('/srv/mitsailing-data/cms-media/ready/asset-1/race-day.jpg');
  });

  it('rejects unsafe tus upload ids', () => {
    expect(
      resolveTusUploadFilePath({
        root,
        uploadId: '../escape',
      })
    ).toBeNull();
  });

  it('maps ready file paths to media URLs', () => {
    expect(
      buildCmsMediaReadyUrl({
        baseUrl: 'https://media.mitsailing.com/',
        publicPath: '/cms-media/asset-1/race-day.jpg',
      })
    ).toBe('https://media.mitsailing.com/cms-media/asset-1/race-day.jpg');
  });
});
```

- [ ] **Step 2: Run storage tests and verify failure**

Run:

```bash
npm run test -- --run src/libs/mit-sailing/cmsMediaFileStorage.test.ts
```

Expected: FAIL because the storage helper does not exist.

- [ ] **Step 3: Implement storage helpers**

Create `src/libs/mit-sailing/cmsMediaFileStorage.ts`:

```ts
import 'server-only';
import path from 'node:path';

function isStorageSegment(value: string): boolean {
  return (
    value.length > 0 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !value.includes('\\')
  );
}

function containedPath(root: string, ...segments: string[]): string | null {
  if (!segments.every(isStorageSegment)) {
    return null;
  }
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, ...segments);
  const rootPrefix = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : `${resolvedRoot}${path.sep}`;
  return candidate.startsWith(rootPrefix) ? candidate : null;
}

export function buildCmsMediaReadyPath(props: {
  assetId: string;
  filename: string;
  root: string;
}): string | null {
  return containedPath(props.root, 'ready', props.assetId, props.filename);
}

export function resolveTusUploadFilePath(props: {
  root: string;
  uploadId: string;
}): string | null {
  return containedPath(props.root, 'uploads', props.uploadId);
}

export function buildCmsMediaReadyUrl(props: {
  baseUrl: string;
  publicPath: string;
}): string {
  return `${props.baseUrl.replace(/\/$/u, '')}${props.publicPath}`;
}
```

- [ ] **Step 4: Run storage tests and type checks**

Run:

```bash
npm run test -- --run src/libs/mit-sailing/cmsMediaFileStorage.test.ts
npm run check:types
```

Expected: PASS.

- [ ] **Step 5: Commit storage helpers**

Run:

```bash
git add src/libs/mit-sailing/cmsMediaFileStorage.ts src/libs/mit-sailing/cmsMediaFileStorage.test.ts
git commit -m "feat: add cms media server-folder storage"
```

### Task 5: Add Upload Sessions and Finalize

**Files:**
- Create: `src/libs/mit-sailing/cmsMediaUploadSessions.ts`
- Create: `src/libs/mit-sailing/cmsMediaUploadSessions.test.ts`
- Create: `src/app/api/admin/cms-media/uploads/route.ts`
- Create: `src/app/api/admin/cms-media/uploads/[id]/route.ts`
- Create: `src/app/api/admin/cms-media/uploads/[id]/finalize/route.ts`
- Modify: `src/app/api/admin/cms-media/route.ts`

- [ ] **Step 1: Write failing upload-session tests**

Create `src/libs/mit-sailing/cmsMediaUploadSessions.test.ts`:

```ts
import {
  createCmsMediaUploadSession,
  finalizeCmsMediaUploadSession,
} from '@/libs/mit-sailing/cmsMediaUploadSessions';

describe('cms media upload sessions', () => {
  it('creates an uploading asset and returns the data-server upload endpoint', async () => {
    const deps = fakeUploadSessionDeps();

    const session = await createCmsMediaUploadSession(deps, {
      byteSize: 1024,
      declaredMimeType: 'image/png',
      originalFilename: 'Race Day.png',
      pageId: null,
      userId: 'admin-1',
    });

    expect(session.asset.status).toBe('uploading');
    expect(session.asset.publicPath).toBe('/cms-media/asset-1/race-day.png');
    expect(session.upload.endpoint).toBe('https://uploads.mitsailing.com/files');
    expect(session.upload.metadata.assetId).toBe('asset-1');
    expect(deps.db.cmsMediaAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'uploading',
          storageProvider: 'server_folder',
        }),
      })
    );
  });

  it('finalizes a completed tus upload and enqueues processing once', async () => {
    const deps = fakeUploadSessionDeps({
      rawUploadId: null,
      status: 'uploading',
    });

    const result = await finalizeCmsMediaUploadSession(deps, {
      assetId: 'asset-1',
      uploadUrl: 'https://uploads.mitsailing.com/files/upload-1',
      userId: 'admin-1',
    });

    expect(result.status).toBe('queued');
    expect(deps.queue.add).toHaveBeenCalledWith(
      'cms-media-process',
      { assetId: 'asset-1' },
      expect.objectContaining({ jobId: 'cms-media-process:asset-1' })
    );
  });
});
```

Add a `fakeUploadSessionDeps` helper with mocked `db`, `queue`, `id`, `env`, and `uploadVerifier`. The fake id returns `asset-1`, `env.MEDIA_UPLOAD_BASE_URL` is `https://uploads.mitsailing.com`, and `uploadVerifier.verifyCompleteUpload` resolves `{ ok: true, uploadId: 'upload-1', rawFilePath: '/srv/mitsailing-data/cms-media/uploads/upload-1' }`.

- [ ] **Step 2: Run upload-session tests and verify failure**

Run:

```bash
npm run test -- --run src/libs/mit-sailing/cmsMediaUploadSessions.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement upload-session service**

Create `src/libs/mit-sailing/cmsMediaUploadSessions.ts`:

```ts
import 'server-only';
import { randomUUID } from 'node:crypto';
import type { JobsOptions, Queue } from 'bullmq';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import {
  buildCmsMediaPublicPath,
  validateCmsMediaMetadata,
} from '@/libs/mit-sailing/cmsMediaValidation';
import type { CmsMediaUploadSession } from '@/libs/mit-sailing/cmsMediaTypes';
import { getDefaultQueue } from '@/worker/defaultQueue';

export const CMS_MEDIA_PROCESSING_JOB_NAME = 'cms-media-process';

const CMS_MEDIA_PROCESSING_JOB_OPTS: JobsOptions = {
  attempts: 5,
  backoff: { delay: 60_000, type: 'exponential' },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

export type CreateCmsMediaUploadSessionInput = {
  byteSize: number;
  declaredMimeType: string;
  originalFilename: string;
  pageId: string | null;
  userId: string;
};

export type FinalizeCmsMediaUploadSessionInput = {
  assetId: string;
  uploadUrl: string;
  userId: string;
};
```

Add `createCmsMediaUploadSession`:

```ts
export async function createCmsMediaUploadSession(
  input: CreateCmsMediaUploadSessionInput
): Promise<CmsMediaUploadSession> {
  const validation = validateCmsMediaMetadata({
    byteSize: input.byteSize,
    declaredMimeType: input.declaredMimeType,
    originalFilename: input.originalFilename,
  });
  if (!validation.ok) {
    throw new TypeError(validation.code);
  }
  if (!Env.MEDIA_UPLOAD_BASE_URL) {
    throw new Error('MEDIA_UPLOAD_BASE_URL is required');
  }
  const id = randomUUID();
  const publicPath = buildCmsMediaPublicPath({
    filename: validation.storedFilename,
    id,
  });
  const asset = await prisma.cmsMediaAsset.create({
    data: {
      byteSize: input.byteSize,
      mediaKind: validation.mediaKind,
      mimeType: validation.mimeType,
      originalFilename: input.originalFilename,
      pageId: input.pageId,
      publicPath,
      status: 'uploading',
      storageProvider: 'server_folder',
      storedFilename: validation.storedFilename,
      uploadedByUserId: input.userId,
    },
    select: {
      createdAt: true,
      id: true,
      mediaKind: true,
      originalFilename: true,
      publicPath: true,
      status: true,
    },
  });
  return {
    asset: {
      ...asset,
      createdAt: asset.createdAt.toISOString(),
      status: 'uploading',
    },
    upload: {
      endpoint: `${Env.MEDIA_UPLOAD_BASE_URL.replace(/\/$/u, '')}/files`,
      headers: Env.MEDIA_UPLOAD_SHARED_SECRET
        ? { Authorization: `Bearer ${Env.MEDIA_UPLOAD_SHARED_SECRET}` }
        : {},
      metadata: {
        assetId: asset.id,
        filename: validation.storedFilename,
        mimeType: validation.mimeType,
      },
    },
  };
}
```

Add `finalizeCmsMediaUploadSession`:

```ts
export async function finalizeCmsMediaUploadSession(
  input: FinalizeCmsMediaUploadSessionInput,
  queue: Queue = getDefaultQueue()
): Promise<{ id: string; publicPath: string; status: string }> {
  const asset = await prisma.cmsMediaAsset.findUnique({
    where: { id: input.assetId },
    select: {
      id: true,
      publicPath: true,
      rawUploadId: true,
      status: true,
      uploadedByUserId: true,
    },
  });
  if (!asset || asset.uploadedByUserId !== input.userId) {
    throw new TypeError('upload_not_found');
  }
  if (asset.status === 'queued' || asset.status === 'processing' || asset.status === 'ready') {
    return { id: asset.id, publicPath: asset.publicPath, status: asset.status };
  }
  const verified = await verifyTusUploadComplete({
    uploadUrl: input.uploadUrl,
  });
  if (!verified.ok) {
    throw new TypeError('upload_not_complete');
  }
  const updated = await prisma.cmsMediaAsset.update({
    data: {
      rawFilePath: verified.rawFilePath,
      rawUploadId: verified.uploadId,
      status: 'queued',
    },
    select: {
      id: true,
      publicPath: true,
      status: true,
    },
    where: { id: asset.id },
  });
  await queue.add(
    CMS_MEDIA_PROCESSING_JOB_NAME,
    { assetId: asset.id },
    {
      ...CMS_MEDIA_PROCESSING_JOB_OPTS,
      jobId: `${CMS_MEDIA_PROCESSING_JOB_NAME}:${asset.id}`,
    }
  );
  return updated;
}
```

Implement `verifyTusUploadComplete` so it:

- rejects upload URLs whose origin does not match `MEDIA_UPLOAD_BASE_URL`;
- sends `HEAD` to the tus upload URL;
- checks `Upload-Length` equals `Upload-Offset`;
- extracts the upload id from the URL pathname;
- maps it to `/srv/mitsailing-data/cms-media/uploads/<uploadId>` with `resolveTusUploadFilePath`.

- [ ] **Step 4: Add admin routes**

Create the three route files. Each route uses `export const runtime = 'nodejs'`, checks `getCurrentUser()` and `Role.ADMIN`, parses JSON without `any`, and returns short error codes:

- `POST /api/admin/cms-media/uploads`: create session.
- `GET /api/admin/cms-media/uploads/[id]`: return current status.
- `POST /api/admin/cms-media/uploads/[id]/finalize`: finalize and enqueue.

In `src/app/api/admin/cms-media/route.ts`, keep `GET`, include new fields, and return `410 direct_media_post_disabled` from `POST` when `APP_ENV` is `staging` or `production`.

- [ ] **Step 5: Run upload-session checks**

Run:

```bash
npm run test -- --run src/libs/mit-sailing/cmsMediaUploadSessions.test.ts
npm run check:types
```

Expected: PASS.

- [ ] **Step 6: Commit upload sessions**

Run:

```bash
git add src/libs/mit-sailing/cmsMediaUploadSessions.ts src/libs/mit-sailing/cmsMediaUploadSessions.test.ts src/app/api/admin/cms-media
git commit -m "feat: add durable cms media upload sessions"
```

## Phase 3: Queue-only Processing and Serving

### Task 6: Add CMS Media Processing Job

**Files:**
- Create: `src/worker/cmsMediaProcessingJob.ts`
- Create: `src/worker/cmsMediaProcessingJob.test.ts`
- Modify: `src/worker/index.ts`

- [ ] **Step 1: Write failing worker tests**

Create `src/worker/cmsMediaProcessingJob.test.ts`:

```ts
import {
  CMS_MEDIA_PROCESSING_JOB_NAME,
  enqueueCmsMediaProcessingJob,
  processCmsMediaProcessingJob,
} from '@/worker/cmsMediaProcessingJob';

describe('cms media processing job', () => {
  it('uses a stable BullMQ job id', async () => {
    const queue = { add: vi.fn().mockResolvedValue({}) };

    await enqueueCmsMediaProcessingJob(queue, { assetId: 'asset-1' });

    expect(queue.add).toHaveBeenCalledWith(
      CMS_MEDIA_PROCESSING_JOB_NAME,
      { assetId: 'asset-1' },
      expect.objectContaining({ jobId: 'cms-media-process:asset-1' })
    );
  });

  it('marks queued assets ready after copying raw upload to the ready folder', async () => {
    const deps = fakeProcessingDeps({
      rawFilePath: '/srv/mitsailing-data/cms-media/uploads/upload-1',
      status: 'queued',
    });

    await processCmsMediaProcessingJob(deps, { assetId: 'asset-1' });

    expect(deps.files.copyFile).toHaveBeenCalledWith(
      '/srv/mitsailing-data/cms-media/uploads/upload-1',
      '/srv/mitsailing-data/cms-media/ready/asset-1/race.png'
    );
    expect(deps.db.cmsMediaAsset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          readyFilePath: '/srv/mitsailing-data/cms-media/ready/asset-1/race.png',
          status: 'ready',
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run worker tests and verify failure**

Run:

```bash
npm run test -- --run src/worker/cmsMediaProcessingJob.test.ts
```

Expected: FAIL because the job file does not exist.

- [ ] **Step 3: Implement worker job**

Create `src/worker/cmsMediaProcessingJob.ts` with:

```ts
import { mkdir, copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { JobsOptions, Queue } from 'bullmq';
import * as z from 'zod';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { buildCmsMediaReadyPath } from '@/libs/mit-sailing/cmsMediaFileStorage';
import { detectCmsMediaKind } from '@/libs/mit-sailing/cmsMediaValidation';

export const CMS_MEDIA_PROCESSING_JOB_NAME = 'cms-media-process';

const cmsMediaProcessingJobDataSchema = z.object({
  assetId: z.string().min(1),
});

const CMS_MEDIA_PROCESSING_JOB_OPTS: JobsOptions = {
  attempts: 5,
  backoff: { delay: 60_000, type: 'exponential' },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

export type CmsMediaProcessingJobData = z.infer<
  typeof cmsMediaProcessingJobDataSchema
>;

export type CmsMediaProcessingQueue = Pick<
  Queue<CmsMediaProcessingJobData>,
  'add'
>;

export async function enqueueCmsMediaProcessingJob(
  queue: CmsMediaProcessingQueue,
  data: CmsMediaProcessingJobData
): Promise<void> {
  await queue.add(CMS_MEDIA_PROCESSING_JOB_NAME, data, {
    ...CMS_MEDIA_PROCESSING_JOB_OPTS,
    jobId: `${CMS_MEDIA_PROCESSING_JOB_NAME}:${data.assetId}`,
  });
}
```

Implement `processCmsMediaProcessingJob(data)` to:

1. parse `{ assetId }`;
2. load the asset;
3. return early if already `ready`;
4. update status to `processing`;
5. read enough bytes from `rawFilePath` to validate kind/signature;
6. create `ready/<assetId>/`;
7. copy raw file to the ready path for the first release;
8. update `readyFilePath`, `processedAt`, `metadata`, and `status='ready'`;
9. on failure update `processingErrorCode` and `status='failed'`, then rethrow.

- [ ] **Step 4: Register the worker job**

In `src/worker/index.ts`, import and dispatch:

```ts
import {
  CMS_MEDIA_PROCESSING_JOB_NAME,
  processCmsMediaProcessingJob,
} from '@/worker/cmsMediaProcessingJob';
```

```ts
  if (job.name === CMS_MEDIA_PROCESSING_JOB_NAME) {
    await processCmsMediaProcessingJob(job.data);
    return;
  }
```

- [ ] **Step 5: Run worker checks**

Run:

```bash
npm run test -- --run src/worker/cmsMediaProcessingJob.test.ts
npm run check:types
```

Expected: PASS.

- [ ] **Step 6: Commit media processing**

Run:

```bash
git add src/worker/cmsMediaProcessingJob.ts src/worker/cmsMediaProcessingJob.test.ts src/worker/index.ts
git commit -m "feat: process cms media from server folder"
```

### Task 7: Serve Ready Media from the Docker Media Server

**Files:**
- Modify: `src/app/cms-media/[id]/[filename]/route.ts`
- Create or modify: `src/app/cms-media/[id]/[filename]/route.test.ts`

- [ ] **Step 1: Write failing route tests**

Create or extend `src/app/cms-media/[id]/[filename]/route.test.ts`:

```ts
import { GET } from './route';

describe('/cms-media/:id/:filename', () => {
  it('redirects ready server-folder media to the media server URL', async () => {
    mockCmsMediaAsset({
      mimeType: 'image/png',
      publicPath: '/cms-media/asset-1/race.png',
      readyFilePath: '/srv/mitsailing-data/cms-media/ready/asset-1/race.png',
      status: 'ready',
      storageProvider: 'server_folder',
      storedFilename: 'race.png',
    });
    vi.stubEnv('MEDIA_PUBLIC_BASE_URL', 'https://media.mitsailing.com');

    const response = await GET(
      new Request('https://www.mitsailing.com/cms-media/asset-1/race.png'),
      {
        params: Promise.resolve({ filename: 'race.png', id: 'asset-1' }),
      }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://media.mitsailing.com/cms-media/asset-1/race.png'
    );
  });

  it('returns 404 while media is still processing', async () => {
    mockCmsMediaAsset({
      publicPath: '/cms-media/asset-1/race.png',
      readyFilePath: null,
      status: 'processing',
      storageProvider: 'server_folder',
      storedFilename: 'race.png',
    });

    const response = await GET(
      new Request('https://www.mitsailing.com/cms-media/asset-1/race.png'),
      {
        params: Promise.resolve({ filename: 'race.png', id: 'asset-1' }),
      }
    );

    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run route tests and verify failure**

Run:

```bash
npm run test -- --run 'src/app/cms-media/[id]/[filename]/route.test.ts'
```

Expected: FAIL because the route still reads local storage for every asset.

- [ ] **Step 3: Update route behavior**

In `src/app/cms-media/[id]/[filename]/route.ts`, select `status`, `storageProvider`, and `readyFilePath`. Return 404 unless status is `ready`. For `server_folder`, redirect to:

```ts
buildCmsMediaReadyUrl({
  baseUrl: Env.MEDIA_PUBLIC_BASE_URL,
  publicPath: asset.publicPath,
})
```

Keep local file serving only for legacy `storageProvider === 'local'` rows.

- [ ] **Step 4: Run route checks**

Run:

```bash
npm run test -- --run 'src/app/cms-media/[id]/[filename]/route.test.ts'
npm run check:types
```

Expected: PASS.

- [ ] **Step 5: Commit media serving**

Run:

```bash
git add 'src/app/cms-media/[id]/[filename]/route.ts' 'src/app/cms-media/[id]/[filename]/route.test.ts'
git commit -m "feat: serve cms media from docker media server"
```

## Phase 4: Admin UI

### Task 8: Use Resumable Uploads in Admin Controls

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/components/mit-sailing/admin/catalog/AdminCmsMediaControls.tsx`
- Modify: `src/components/mit-sailing/admin/catalog/AdminRichTextEditor.tsx`
- Modify: component tests
- Modify: `src/locales/en.json`

- [ ] **Step 1: Add upload client dependency**

Run:

```bash
npm install tus-js-client
```

Expected: `package.json` and `package-lock.json` include `tus-js-client`.

- [ ] **Step 2: Write failing component tests for session upload flow**

Update existing admin upload tests so `uploadCmsMediaFile` is expected to:

1. `POST /api/admin/cms-media/uploads`;
2. create a tus upload to `https://uploads.mitsailing.com/files`;
3. `POST /api/admin/cms-media/uploads/<assetId>/finalize`;
4. poll `GET /api/admin/cms-media/uploads/<assetId>` until `ready`.

Use mocked responses:

```ts
{
  asset: {
    createdAt: '2026-05-16T12:00:00.000Z',
    id: 'asset-1',
    mediaKind: 'image',
    originalFilename: 'race.png',
    publicPath: '/cms-media/asset-1/race.png',
    status: 'uploading'
  },
  upload: {
    endpoint: 'https://uploads.mitsailing.com/files',
    headers: { Authorization: 'Bearer test-secret' },
    metadata: {
      assetId: 'asset-1',
      filename: 'race.png',
      mimeType: 'image/png'
    }
  }
}
```

- [ ] **Step 3: Run component tests and verify failure**

Run:

```bash
npm run test -- --run src/components/mit-sailing/admin/catalog/AdminCatalogRichText.test.tsx src/components/mit-sailing/admin/catalog/AdminRichTextEditor.test.tsx
```

Expected: FAIL because the helper still posts `FormData` to `/api/admin/cms-media`.

- [ ] **Step 4: Implement tus upload helper**

In `AdminCmsMediaControls.tsx`, replace the direct `FormData` upload with:

```ts
import * as tus from 'tus-js-client';

function uploadWithTus(props: {
  endpoint: string;
  file: File;
  headers: Record<string, string>;
  metadata: Record<string, string>;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(props.file, {
      endpoint: props.endpoint,
      headers: props.headers,
      metadata: props.metadata,
      onError: reject,
      onSuccess: () => {
        if (!upload.url) {
          reject(new Error('missing_tus_upload_url'));
          return;
        }
        resolve(upload.url);
      },
      retryDelays: [0, 1000, 3000, 5000],
    });
    upload.start();
  });
}
```

Update `uploadCmsMediaFile` to create the session, call `uploadWithTus`, finalize with `{ uploadUrl }`, then poll status until `ready` or `failed`.

- [ ] **Step 5: Add UI states**

Extend `CmsMediaAsset` with:

```ts
mediaKind: 'image' | 'file' | 'video';
processingErrorCode?: string | null;
status: 'uploading' | 'queued' | 'processing' | 'ready' | 'failed';
```

Only insert into image fields and rich text when `mediaKind === 'image'` and `status === 'ready'`. Show localized labels for queued, processing, ready, and failed.

- [ ] **Step 6: Run UI checks**

Run:

```bash
npm run test -- --run src/components/mit-sailing/admin/catalog/AdminCatalogRichText.test.tsx src/components/mit-sailing/admin/catalog/AdminRichTextEditor.test.tsx
npm run check:i18n
npm run check:types
```

Expected: PASS.

- [ ] **Step 7: Commit admin upload controls**

Run:

```bash
git add package.json package-lock.json src/components/mit-sailing/admin/catalog src/locales/en.json
git commit -m "feat: upload admin media to docker media server"
```

### Task 9: Add Admin Media Library for Files and Videos

**Files:**
- Create: `src/components/mit-sailing/admin/media/AdminMediaLibrary.tsx`
- Create: `src/components/mit-sailing/admin/media/AdminMediaLibrary.test.tsx`
- Create: `src/app/[locale]/(marketing)/(site)/admin/media/page.tsx`
- Modify: `src/app/[locale]/(marketing)/(site)/admin/layout.tsx`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Write failing media library test**

Create `src/components/mit-sailing/admin/media/AdminMediaLibrary.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminMediaLibrary } from '@/components/mit-sailing/admin/media/AdminMediaLibrary';

describe('AdminMediaLibrary', () => {
  it('uploads files and videos through the shared media helper', async () => {
    const upload = vi.fn().mockResolvedValue({
      createdAt: '2026-05-16T12:00:00.000Z',
      id: 'asset-1',
      mediaKind: 'video',
      originalFilename: 'dock-tour.mp4',
      publicPath: '/cms-media/asset-1/dock-tour.mp4',
      status: 'ready',
    });

    render(<AdminMediaLibrary initialAssets={[]} uploadMedia={upload} />);

    const file = new File(['video'], 'dock-tour.mp4', { type: 'video/mp4' });
    await userEvent.upload(screen.getByLabelText('Upload media'), file);

    expect(upload).toHaveBeenCalledWith({ file, pageId: undefined });
    expect(await screen.findByText('dock-tour.mp4')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run media library tests and verify failure**

Run:

```bash
npm run test -- --run src/components/mit-sailing/admin/media/AdminMediaLibrary.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement media library and page**

Create a client component with a dense admin table for filename, kind, status, size, date, and link. Create the admin page under `src/app/[locale]/(marketing)/(site)/admin/media/page.tsx` using the same admin auth pattern as nearby admin pages and `setRequestLocale(locale)`.

- [ ] **Step 4: Run media library checks**

Run:

```bash
npm run test -- --run src/components/mit-sailing/admin/media/AdminMediaLibrary.test.tsx
npm run check:i18n
npm run check:types
```

Expected: PASS.

- [ ] **Step 5: Commit media library**

Run:

```bash
git add src/components/mit-sailing/admin/media src/app/[locale]/\\(marketing\\)/\\(site\\)/admin/media/page.tsx src/app/[locale]/\\(marketing\\)/\\(site\\)/admin/layout.tsx src/locales/en.json
git commit -m "feat: add admin media library"
```

## Phase 5: Docker Topology and Deploy

### Task 10: Add Readiness Gates

**Files:**
- Modify: `src/libs/health/readiness.ts`
- Modify: `src/libs/health/readiness.test.ts`
- Modify: `src/app/api/health/ready/route.ts`
- Modify: route tests

- [ ] **Step 1: Write failing readiness tests**

Add tests that prove:

- `HOST_TRAFFIC_ENABLED=false` makes public readiness fail;
- `mode=service` skips traffic gate for deploy pre-promotion checks;
- readiness checks Postgres, Redis, media upload service, and media public URL.

- [ ] **Step 2: Run readiness tests and verify failure**

Run:

```bash
npm run test -- --run src/libs/health/readiness.test.ts src/app/api/health/ready/route.test.ts
```

Expected: FAIL until traffic and media checks exist.

- [ ] **Step 3: Implement readiness checks**

Update readiness to include bounded HTTP checks:

```ts
await fetch(`${Env.MEDIA_UPLOAD_BASE_URL}/`, { method: 'HEAD', signal });
await fetch(`${Env.MEDIA_PUBLIC_BASE_URL}/healthz`, { method: 'HEAD', signal });
```

Keep Postgres and Redis checks bounded. Public readiness includes the traffic gate; `mode=service` skips only the traffic gate.

- [ ] **Step 4: Run readiness checks**

Run:

```bash
npm run test -- --run src/libs/health/readiness.test.ts src/app/api/health/ready/route.test.ts
npm run check:types
```

Expected: PASS.

- [ ] **Step 5: Commit readiness gates**

Run:

```bash
git add src/libs/health src/app/api/health/ready
git commit -m "feat: gate readiness for docker blue green hosts"
```

### Task 11: Add Docker Compose Files

**Files:**
- Create: `compose.prod.data.yaml`
- Create: `compose.prod.app-host.yaml`
- Modify: `compose.prod.yaml`
- Create: `docker/nginx/media.conf`
- Create: `src/libs/deploy/dockerComposeContract.test.ts`

- [ ] **Step 1: Write failing compose contract tests**

Create `src/libs/deploy/dockerComposeContract.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('production docker topology', () => {
  it('keeps postgres redis and media services on the data server', () => {
    const dataCompose = readRepoFile('compose.prod.data.yaml');
    expect(dataCompose).toContain('postgres:');
    expect(dataCompose).toContain('redis:');
    expect(dataCompose).toContain('media-upload:');
    expect(dataCompose).toContain('media-worker:');
    expect(dataCompose).toContain('media:');
    expect(dataCompose).toContain('/srv/mitsailing-data/postgres');
    expect(dataCompose).toContain('/srv/mitsailing-data/redis');
    expect(dataCompose).toContain('/srv/mitsailing-data/cms-media');
  });

  it('keeps app hosts stateless for uploaded media', () => {
    const appCompose = readRepoFile('compose.prod.app-host.yaml');
    expect(appCompose).toContain('web:');
    expect(appCompose).toContain('cloudflared:');
    expect(appCompose).not.toContain('/srv/mitsailing-data/cms-media');
    expect(appCompose).not.toContain('postgres:');
    expect(appCompose).not.toContain('redis:');
  });
});
```

- [ ] **Step 2: Run compose tests and verify failure**

Run:

```bash
npm run test -- --run src/libs/deploy/dockerComposeContract.test.ts
```

Expected: FAIL because the split Compose files do not exist.

- [ ] **Step 3: Add data/media server Compose**

Create `compose.prod.data.yaml`:

```yaml
services:
  postgres:
    image: postgres:18-alpine
    restart: unless-stopped
    env_file:
      - path: .env.production.data
        required: true
    volumes:
      - type: bind
        source: /srv/mitsailing-data/postgres
        target: /var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"']
      interval: 10s
      timeout: 5s
      retries: 6

  redis:
    image: redis:8-alpine
    restart: unless-stopped
    command: ['redis-server', '--appendonly', 'yes']
    volumes:
      - type: bind
        source: /srv/mitsailing-data/redis
        target: /data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 6

  media-upload:
    image: tusproject/tusd:v2.8
    restart: unless-stopped
    command:
      - -host=0.0.0.0
      - -port=1080
      - -base-path=/files/
      - -upload-dir=/srv/mitsailing-data/cms-media/uploads
      - -behind-proxy
    volumes:
      - type: bind
        source: /srv/mitsailing-data/cms-media/uploads
        target: /srv/mitsailing-data/cms-media/uploads

  media-worker:
    image: ${APP_IMAGE}
    restart: unless-stopped
    env_file:
      - path: .env.production.data
        required: true
      - path: .env.production.worker
        required: false
      - path: .env.image
        required: true
    command: ['node', 'worker.mjs']
    volumes:
      - type: bind
        source: /srv/mitsailing-data/cms-media
        target: /srv/mitsailing-data/cms-media
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  media:
    image: nginx:1.29-alpine
    restart: unless-stopped
    volumes:
      - ./docker/nginx/media.conf:/etc/nginx/conf.d/default.conf:ro
      - type: bind
        source: /srv/mitsailing-data/cms-media/ready
        target: /usr/share/nginx/html/cms-media
        read_only: true
```

Create `docker/nginx/media.conf` with a `/healthz` route and immutable static file serving under `/cms-media/`.

- [ ] **Step 4: Add app-host Compose**

Create `compose.prod.app-host.yaml`:

```yaml
services:
  web:
    image: ${APP_IMAGE}
    restart: unless-stopped
    env_file:
      - path: .env.production
        required: true
      - path: .env.image
        required: true
    ports:
      - '3000:3000'
    stop_grace_period: 60s
    command: ['node', 'server.js']
    healthcheck:
      test:
        [
          'CMD-SHELL',
          'wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/health/live',
        ]
      interval: 10s
      timeout: 5s
      retries: 6

  cloudflared:
    image: cloudflare/cloudflared:2026.5.0
    restart: unless-stopped
    command:
      - tunnel
      - --no-autoupdate
      - run
      - --token
      - ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      web:
        condition: service_healthy
```

At the top of `compose.prod.yaml`, mark it as legacy single-host only.

- [ ] **Step 5: Run compose checks**

Run:

```bash
npm run test -- --run src/libs/deploy/dockerComposeContract.test.ts
npm run check:types
```

Expected: PASS.

- [ ] **Step 6: Commit Docker topology**

Run:

```bash
git add compose.prod.data.yaml compose.prod.app-host.yaml compose.prod.yaml docker/nginx/media.conf src/libs/deploy/dockerComposeContract.test.ts
git commit -m "feat: split docker data and app host topology"
```

### Task 12: Add Two-host Deploy Script and Runbook

**Files:**
- Create: `bin/deploy-two-host.sh`
- Create: `src/libs/deploy/twoHostDeployScript.test.ts`
- Modify: `docs/deploy.md`

- [ ] **Step 1: Write failing deploy script tests**

Create `src/libs/deploy/twoHostDeployScript.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('two host deploy script', () => {
  const script = readRepoFile('bin/deploy-two-host.sh');

  it('deploys the inactive host before public promotion', () => {
    expect(script).toContain('deploy_inactive_host');
    expect(script).toContain('wait_for_service_readiness');
    expect(script).toContain('promote_host');
    expect(script).toContain('demote_host');
  });

  it('runs migrations once before promotion', () => {
    expect(script).toContain('run_migrations');
    expect(script).toContain('prisma migrate deploy');
  });

  it('uses HOST_TRAFFIC_ENABLED for proxy health gating', () => {
    expect(script).toContain('HOST_TRAFFIC_ENABLED=false');
    expect(script).toContain('HOST_TRAFFIC_ENABLED=true');
    expect(script).toContain('/api/health/ready?mode=service');
  });

  it('states that rollback does not reverse database or file writes', () => {
    expect(script).toContain('rollback does not reverse migrations or media files');
  });
});
```

- [ ] **Step 2: Run deploy script tests and verify failure**

Run:

```bash
npm run test -- --run src/libs/deploy/twoHostDeployScript.test.ts
```

Expected: FAIL because the deploy script does not exist.

- [ ] **Step 3: Create deploy script**

Create `bin/deploy-two-host.sh` that:

- accepts `release <sha-tag>` and `rollback`;
- writes `.env.image` with `APP_IMAGE` and `DEPLOYMENT_VERSION`;
- starts the inactive app host with `HOST_TRAFFIC_ENABLED=false`;
- runs `prisma migrate deploy` once from the target image;
- checks `/api/health/ready?mode=service`;
- flips `HOST_TRAFFIC_ENABLED=true` on the target;
- waits for proxy health settling;
- flips `HOST_TRAFFIC_ENABLED=false` on the previous host;
- leaves media files and migrations untouched on rollback.

- [ ] **Step 4: Update deploy docs**

In `docs/deploy.md`, document:

- data/media server Docker Compose startup;
- two app hosts and proxy health checks;
- Postgres and Redis private-network exposure only;
- media uploads going to the data/media server, not app hosts;
- rollback limits;
- cron enablement:

```dotenv
LEGACY_MYSQL_SYNC_ENABLED=true
LEGACY_MYSQL_SYNC_CRON="0 0 * * * *"
LEGACY_MYSQL_PASSWORD=<real readonly mysql password>
```

Then:

```bash
docker compose -f compose.prod.data.yaml --env-file .env.production.data up -d media-worker
```

Explain that BullMQ schedules cron jobs after the worker registers the scheduler during startup.

- [ ] **Step 5: Run deploy checks**

Run:

```bash
npm run test -- --run src/libs/deploy/twoHostDeployScript.test.ts src/libs/deploy/dockerComposeContract.test.ts
npm run check:types
```

Expected: PASS.

- [ ] **Step 6: Commit deploy script and docs**

Run:

```bash
git add bin/deploy-two-host.sh src/libs/deploy/twoHostDeployScript.test.ts docs/deploy.md
git commit -m "feat: add two host docker deploy workflow"
```

## Phase 6: Verification

### Task 13: Add E2E Upload Verification

**Files:**
- Create: `tests/e2e/admin-media-upload.e2e.ts`
- Modify: local/e2e env setup as needed.

- [ ] **Step 1: Write the failing e2e test**

Create `tests/e2e/admin-media-upload.e2e.ts`:

```ts
import { expect, test } from '@playwright/test';
import { signInAsAdmin } from './helpers/e2e-admin-sign-in';

test.describe('admin media uploads', () => {
  test('uploads media through the docker media server pipeline', async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/media');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload media' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      buffer: Buffer.from('%PDF-1.4\n%MIT Sailing test\n'),
      mimeType: 'application/pdf',
      name: 'sailing-handbook.pdf',
    });

    await expect(page.getByText('sailing-handbook.pdf')).toBeVisible();
    await expect(page.getByText(/ready|processing|queued/u)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run e2e test and verify failure**

Run:

```bash
npm run test:e2e -- --grep "admin media uploads"
```

Expected: FAIL until local Docker has the upload service, media worker, and media page wired.

- [ ] **Step 3: Wire local Docker media services**

Use local Docker services equivalent to production:

- `media-upload` with local `local/cms-media/uploads`;
- `media` with local `local/cms-media/ready`;
- worker with `MEDIA_STORAGE_ROOT=local/cms-media`;
- app with `MEDIA_UPLOAD_BASE_URL=http://127.0.0.1:1080` and `MEDIA_PUBLIC_BASE_URL=http://127.0.0.1:8080`.

- [ ] **Step 4: Run final checks**

Run:

```bash
npm run test:e2e -- --grep "admin media uploads"
npm run lint
npm run check:types
npm run test
npm run build-local
```

Expected: PASS.

- [ ] **Step 5: Commit e2e verification**

Run:

```bash
git add tests/e2e/admin-media-upload.e2e.ts compose.yaml docs/deploy.md
git commit -m "test: verify durable docker media uploads"
```

### Task 14: Add Production Rehearsal Checklist

**Files:**
- Modify: `docs/deploy.md`

- [ ] **Step 1: Add the rehearsal checklist**

Add to `docs/deploy.md`:

````md
## Zero-downtime rehearsal

1. Start the data/media server:

   ```bash
   docker compose -f compose.prod.data.yaml --env-file .env.production.data up -d
   ```

2. Start both app hosts with `HOST_TRAFFIC_ENABLED=false`.

3. Run service readiness on both hosts:

   ```bash
   curl -fsS -H "x-healthcheck-secret: $HEALTHCHECK_SECRET" \
     "http://127.0.0.1:3000/api/health/ready?mode=service"
   ```

4. Promote blue by setting `HOST_TRAFFIC_ENABLED=true` and recreating `web`.

5. Start an admin video upload and confirm browser network traffic goes to the
   data/media server upload endpoint, not the app host.

6. While the upload is in progress, deploy green with
   `bin/deploy-two-host.sh release sha-<merged-main-sha>`.

7. Confirm the upload finishes, finalize retries succeed, and the asset reaches
   `ready`.

8. Run rollback with `bin/deploy-two-host.sh rollback` and confirm public pages
   still serve ready media.

9. Stop the active app host and confirm Cloudflare/proxy routes to the other
   healthy host.
````

- [ ] **Step 2: Run docs and final local checks**

Run:

```bash
npm run test -- --run src/libs/deploy/dockerComposeContract.test.ts src/libs/deploy/twoHostDeployScript.test.ts
npm run lint
npm run check:types
npm run test
```

Expected: PASS.

- [ ] **Step 3: Commit rehearsal docs**

Run:

```bash
git add docs/deploy.md
git commit -m "docs: add zero downtime docker rehearsal"
```

## Acceptance Criteria

- Postgres runs in Docker on the data/media server with persistent storage under `/srv/mitsailing-data/postgres`.
- Redis runs in Docker on the data/media server with append-only persistence under `/srv/mitsailing-data/redis`.
- Uploaded files are stored on the data/media server under `/srv/mitsailing-data/cms-media`.
- App hosts do not have independent writable CMS media folders.
- Browser uploads images, files, and videos directly to the Dockerized media upload service.
- BullMQ starts after upload completion; it handles processing, retries, and cron, not the raw upload transfer.
- Finalize is retry-safe and enqueueing uses stable BullMQ job ids.
- Public `/cms-media/:id/:filename` serves only `ready` assets via the Docker media server.
- Rich text and image fields insert only ready images.
- Admin media library supports image, file, and video uploads.
- `compose.prod.data.yaml` runs Dockerized Postgres, Redis, media upload, media worker, and media serving.
- `compose.prod.app-host.yaml` runs Dockerized stateless web and ingress connector on each app host.
- Readiness includes Postgres, Redis, media upload service, media serving, and `HOST_TRAFFIC_ENABLED`.
- Rollback is a traffic switch and does not claim to reverse migrations or file writes.
- Cron remains disabled by default and is enabled by editing `.env.production.worker` plus recreating the Docker worker.
- Final verification passes: `npm run lint`, `npm run check:types`, `npm run test`, `npm run test:e2e`, and `npm run build-local`.

## Risks and Guardrails

- The data/media server is a single point of failure unless we add replication or a second data/media node later.
- Uploads remain available through app deploys because the browser uploads to the data/media server, not the app host.
- A data/media server outage interrupts uploads, database access, Redis jobs, and media serving.
- Database migrations must be expand/contract because two app versions overlap during promotion.
- Rollback does not delete uploaded files or reverse database migrations.
- Large video continuity depends on the resumable upload service and retryable finalize, not Docker drain windows.
