CREATE TYPE "public_slug_source" AS ENUM ('automatic', 'migration', 'manual');

CREATE TYPE "legacy_redirect_source" AS ENUM ('ai_migration', 'manual');

CREATE TABLE "public_slugs" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "sluggable_type" TEXT NOT NULL,
  "sluggable_id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "source" "public_slug_source" NOT NULL DEFAULT 'automatic',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "public_slugs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legacy_redirects" (
  "id" TEXT NOT NULL,
  "source_path" TEXT NOT NULL,
  "target_path" TEXT NOT NULL,
  "source" "legacy_redirect_source" NOT NULL DEFAULT 'manual',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legacy_redirects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "public_slugs_slug_sluggable_type_scope_key"
  ON "public_slugs"("slug", "sluggable_type", "scope");

CREATE INDEX "public_slugs_sluggable_type_sluggable_id_idx"
  ON "public_slugs"("sluggable_type", "sluggable_id");

CREATE INDEX "public_slugs_scope_slug_idx"
  ON "public_slugs"("scope", "slug");

CREATE UNIQUE INDEX "legacy_redirects_source_path_key"
  ON "legacy_redirects"("source_path");

CREATE INDEX "legacy_redirects_source_idx"
  ON "legacy_redirects"("source");
