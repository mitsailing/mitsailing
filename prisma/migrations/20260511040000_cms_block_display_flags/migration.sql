ALTER TABLE "cms_page_blocks"
  ADD COLUMN "show_cta" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "show_image" BOOLEAN NOT NULL DEFAULT false;

UPDATE "cms_page_blocks"
SET "show_cta" = true
WHERE "cta_label" IS NOT NULL
  AND "cta_url" IS NOT NULL
  AND length(btrim("cta_label")) > 0
  AND length(btrim("cta_url")) > 0;

UPDATE "cms_page_blocks"
SET "show_image" = true
WHERE "image_src" IS NOT NULL
  AND "image_alt" IS NOT NULL
  AND length(btrim("image_src")) > 0
  AND length(btrim("image_alt")) > 0;
