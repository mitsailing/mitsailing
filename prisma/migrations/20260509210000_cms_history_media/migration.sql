CREATE TYPE "cms_page_revision_action" AS ENUM ('create', 'update', 'delete');

CREATE TABLE "cms_page_revisions" (
  "id" TEXT NOT NULL,
  "page_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "action" "cms_page_revision_action" NOT NULL,
  "snapshot" JSONB NOT NULL,
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cms_page_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cms_media_assets" (
  "id" TEXT NOT NULL,
  "page_id" TEXT,
  "stored_filename" TEXT NOT NULL,
  "original_filename" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "public_path" TEXT NOT NULL,
  "uploaded_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cms_media_assets_pkey" PRIMARY KEY ("id")
);

CREATE FUNCTION update_cms_media_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cms_media_assets_updated_at_trigger
BEFORE UPDATE ON "cms_media_assets"
FOR EACH ROW
EXECUTE FUNCTION update_cms_media_assets_updated_at();

CREATE INDEX "cms_page_revisions_page_id_created_at_idx" ON "cms_page_revisions"("page_id", "created_at");
CREATE INDEX "cms_page_revisions_created_by_user_id_idx" ON "cms_page_revisions"("created_by_user_id");
CREATE UNIQUE INDEX "cms_page_revisions_page_id_version_key" ON "cms_page_revisions"("page_id", "version");

CREATE UNIQUE INDEX "cms_media_assets_public_path_key" ON "cms_media_assets"("public_path");
CREATE INDEX "cms_media_assets_page_id_created_at_idx" ON "cms_media_assets"("page_id", "created_at");
CREATE INDEX "cms_media_assets_uploaded_by_user_id_idx" ON "cms_media_assets"("uploaded_by_user_id");

ALTER TABLE "cms_page_revisions"
  ADD CONSTRAINT "cms_page_revisions_page_id_fkey"
  FOREIGN KEY ("page_id") REFERENCES "cms_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cms_page_revisions"
  ADD CONSTRAINT "cms_page_revisions_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cms_media_assets"
  ADD CONSTRAINT "cms_media_assets_page_id_fkey"
  FOREIGN KEY ("page_id") REFERENCES "cms_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cms_media_assets"
  ADD CONSTRAINT "cms_media_assets_uploaded_by_user_id_fkey"
  FOREIGN KEY ("uploaded_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
