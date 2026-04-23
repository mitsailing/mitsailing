-- CreateTable
CREATE TABLE "class_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "is_visible" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "class_categories_slug_key" ON "class_categories"("slug");

-- Seed category rows (matches prisma/seed + migration backfill mapping)
INSERT INTO "class_categories" ("id", "slug", "name", "display_order", "is_visible", "created_at") VALUES
('cc-introduction', 'introduction', 'Introduction', 0, true, CURRENT_TIMESTAMP),
('cc-windsurfing', 'windsurfing', 'Windsurfing', 1, true, CURRENT_TIMESTAMP),
('cc-intro-to-racing', 'intro-to-racing', 'Intro To Racing', 2, true, CURRENT_TIMESTAMP),
('cc-intermediate-sailing', 'intermediate-sailing', 'Intermediate Sailing', 3, true, CURRENT_TIMESTAMP),
('cc-intermediate-racing', 'intermediate-racing', 'Intermediate Racing', 4, true, CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "sailing_classes" ADD COLUMN "class_category_id" TEXT;

UPDATE "sailing_classes" SET "class_category_id" = 'cc-introduction' WHERE "category" = 'introduction';
UPDATE "sailing_classes" SET "class_category_id" = 'cc-windsurfing' WHERE "category" = 'windsurfing';
UPDATE "sailing_classes" SET "class_category_id" = 'cc-intro-to-racing' WHERE "category" = 'intro to racing';
UPDATE "sailing_classes" SET "class_category_id" = 'cc-intermediate-sailing' WHERE "category" = 'intermediate sailing';
UPDATE "sailing_classes" SET "class_category_id" = 'cc-intermediate-racing' WHERE "category" = 'intermediate racing';

ALTER TABLE "sailing_classes" DROP COLUMN "category";

ALTER TABLE "sailing_classes" ALTER COLUMN "class_category_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "sailing_classes" ADD CONSTRAINT "sailing_classes_class_category_id_fkey" FOREIGN KEY ("class_category_id") REFERENCES "class_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "sailing_classes_class_category_id_idx" ON "sailing_classes"("class_category_id");
