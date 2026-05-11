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

  CONSTRAINT "cms_media_assets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cms_media_assets_byte_size_check" CHECK ("byte_size" > 0)
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

CREATE UNIQUE INDEX "cms_media_assets_public_path_key" ON "cms_media_assets"("public_path");
CREATE INDEX "cms_media_assets_page_id_created_at_idx" ON "cms_media_assets"("page_id", "created_at");
CREATE INDEX "cms_media_assets_uploaded_by_user_id_idx" ON "cms_media_assets"("uploaded_by_user_id");

ALTER TABLE "cms_media_assets"
  ADD CONSTRAINT "cms_media_assets_page_id_fkey"
  FOREIGN KEY ("page_id") REFERENCES "cms_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cms_media_assets"
  ADD CONSTRAINT "cms_media_assets_uploaded_by_user_id_fkey"
  FOREIGN KEY ("uploaded_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "user_audit_action" AS ENUM ('create', 'update', 'delete', 'restore');

CREATE TABLE "user_audit" (
  "id" TEXT NOT NULL,
  "auditable_type" TEXT NOT NULL,
  "auditable_id" TEXT NOT NULL,
  "user_id" TEXT,
  "impersonated_user_id" TEXT,
  "action" "user_audit_action" NOT NULL,
  "audited_changes" JSONB NOT NULL,
  "version" INTEGER NOT NULL,
  "comment" TEXT,
  "remote_address" TEXT,
  "request_uuid" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_audit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_audit_version_check" CHECK ("version" > 0)
);

INSERT INTO "user_audit" (
  "id",
  "auditable_type",
  "auditable_id",
  "action",
  "audited_changes",
  "version",
  "created_at"
)
SELECT
  'baseline-sailing-class-' || sc."id",
  'sailing_classes',
  sc."id",
  'create',
  jsonb_build_object(
    'resource', 'sailing_classes',
    'id', sc."id",
    'name', sc."name",
    'slug', sc."slug",
    'classCategoryId', sc."class_category_id",
    'classCategoryName', cc."name",
    'level', sc."level",
    'description', sc."description",
    'imagePaths', to_jsonb(sc."image_paths"),
    'isVisible', sc."is_visible"
  ),
  1,
  CURRENT_TIMESTAMP
FROM "sailing_classes" sc
LEFT JOIN "class_categories" cc ON cc."id" = sc."class_category_id";

INSERT INTO "user_audit" (
  "id",
  "auditable_type",
  "auditable_id",
  "action",
  "audited_changes",
  "version",
  "created_at"
)
SELECT
  'baseline-fleet-' || fb."id",
  'fleet',
  fb."id",
  'create',
  jsonb_build_object(
    'resource', 'fleet',
    'id', fb."id",
    'name', fb."name",
    'slug', fb."slug",
    'type', fb."type",
    'capacity', fb."capacity",
    'requiredClassId', fb."required_class_id",
    'requiredClassName', sc."name",
    'description', fb."description",
    'imagePaths', to_jsonb(fb."image_paths")
  ),
  1,
  CURRENT_TIMESTAMP
FROM "fleet_boats" fb
LEFT JOIN "sailing_classes" sc ON sc."id" = fb."required_class_id";

UPDATE "user_audit" ua
SET "user_id" = NULL
WHERE ua."user_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "user" u WHERE u."id" = ua."user_id"
  );

UPDATE "user_audit" ua
SET "impersonated_user_id" = NULL
WHERE ua."impersonated_user_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "user" u WHERE u."id" = ua."impersonated_user_id"
  );

CREATE UNIQUE INDEX "user_audit_auditable_type_auditable_id_version_key" ON "user_audit"("auditable_type", "auditable_id", "version");
CREATE INDEX "user_audit_auditable_type_auditable_id_created_at_idx" ON "user_audit"("auditable_type", "auditable_id", "created_at");
CREATE INDEX "user_audit_user_id_idx" ON "user_audit"("user_id");
CREATE INDEX "user_audit_impersonated_user_id_idx" ON "user_audit"("impersonated_user_id");
CREATE INDEX "user_audit_action_idx" ON "user_audit"("action");

ALTER TABLE "user_audit"
  ADD CONSTRAINT "user_audit_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_audit"
  ADD CONSTRAINT "user_audit_impersonated_user_id_fkey"
  FOREIGN KEY ("impersonated_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
