ALTER TABLE "cms_page_blocks"
  ADD COLUMN "show_cta" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "show_image" BOOLEAN NOT NULL DEFAULT false;

UPDATE "cms_page_blocks"
SET "show_cta" = true
WHERE "cta_label" IS NOT NULL OR "cta_url" IS NOT NULL;

UPDATE "cms_page_blocks"
SET "show_image" = true
WHERE "image_src" IS NOT NULL OR "image_alt" IS NOT NULL;
