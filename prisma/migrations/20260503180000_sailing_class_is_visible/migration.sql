-- Add published/live flag for public catalog (matches other catalog entities).

ALTER TABLE "sailing_classes" ADD COLUMN "is_visible" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "sailing_classes_is_visible_idx" ON "sailing_classes" ("is_visible");
