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
WHERE "processed_at" IS NULL;

CREATE INDEX "cms_media_assets_status_created_at_idx"
  ON "cms_media_assets"("status", "created_at");

CREATE INDEX "cms_media_assets_storage_provider_status_idx"
  ON "cms_media_assets"("storage_provider", "status");

CREATE INDEX "cms_media_assets_raw_upload_id_idx"
  ON "cms_media_assets"("raw_upload_id");
