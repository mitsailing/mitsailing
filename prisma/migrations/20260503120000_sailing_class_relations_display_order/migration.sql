-- CreateTable
CREATE TABLE "sailing_class_related_events" (
    "sailing_class_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,

    CONSTRAINT "sailing_class_related_events_pkey" PRIMARY KEY ("sailing_class_id","event_id")
);

-- CreateTable
CREATE TABLE "sailing_class_prerequisites" (
    "sailing_class_id" TEXT NOT NULL,
    "prerequisite_class_id" TEXT NOT NULL,

    CONSTRAINT "sailing_class_prerequisites_pkey" PRIMARY KEY ("sailing_class_id","prerequisite_class_id")
);

-- CreateTable
CREATE TABLE "sailing_class_unlocked_boats" (
    "sailing_class_id" TEXT NOT NULL,
    "fleet_boat_id" TEXT NOT NULL,

    CONSTRAINT "sailing_class_unlocked_boats_pkey" PRIMARY KEY ("sailing_class_id","fleet_boat_id")
);

-- AlterTable (before dropping legacy columns — backfill uses arrays)
ALTER TABLE "sailing_classes" ADD COLUMN "display_order" INTEGER NOT NULL DEFAULT 0;

-- Order classes within each category for catalog (display only)
UPDATE "sailing_classes" sc
SET "display_order" = sub.rn
FROM (
    SELECT id,
           (ROW_NUMBER() OVER (PARTITION BY class_category_id ORDER BY name ASC) - 1)::integer AS rn
    FROM "sailing_classes"
) sub
WHERE sc.id = sub.id;

-- Backfill join rows from legacy PostgreSQL arrays (skip ids missing from target tables — dev DB drift)
INSERT INTO "sailing_class_related_events" ("sailing_class_id", "event_id")
SELECT sc.id, elem
FROM "sailing_classes" sc
CROSS JOIN LATERAL unnest(sc.related_event_ids) AS elem
WHERE cardinality(sc.related_event_ids) > 0
  AND EXISTS (SELECT 1 FROM "events" e WHERE e.id = elem);

INSERT INTO "sailing_class_prerequisites" ("sailing_class_id", "prerequisite_class_id")
SELECT sc.id, elem
FROM "sailing_classes" sc
CROSS JOIN LATERAL unnest(sc.prerequisite_ids) AS elem
WHERE cardinality(sc.prerequisite_ids) > 0
  AND EXISTS (SELECT 1 FROM "sailing_classes" c WHERE c.id = elem);

INSERT INTO "sailing_class_unlocked_boats" ("sailing_class_id", "fleet_boat_id")
SELECT sc.id, elem
FROM "sailing_classes" sc
CROSS JOIN LATERAL unnest(sc.unlocked_boat_ids) AS elem
WHERE cardinality(sc.unlocked_boat_ids) > 0
  AND EXISTS (SELECT 1 FROM "fleet_boats" fb WHERE fb.id = elem);

-- Drop legacy array columns (data preserved in join tables)
ALTER TABLE "sailing_classes" DROP COLUMN "prerequisite_ids",
DROP COLUMN "related_event_ids",
DROP COLUMN "unlocked_boat_ids";

-- CreateIndex
CREATE INDEX "sailing_classes_class_category_id_display_order_idx" ON "sailing_classes"("class_category_id", "display_order");

-- AddForeignKey
ALTER TABLE "sailing_class_related_events" ADD CONSTRAINT "sailing_class_related_events_sailing_class_id_fkey" FOREIGN KEY ("sailing_class_id") REFERENCES "sailing_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sailing_class_related_events" ADD CONSTRAINT "sailing_class_related_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "sailing_class_related_events_event_id_idx" ON "sailing_class_related_events"("event_id");

-- AddForeignKey
ALTER TABLE "sailing_class_prerequisites" ADD CONSTRAINT "sailing_class_prerequisites_sailing_class_id_fkey" FOREIGN KEY ("sailing_class_id") REFERENCES "sailing_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sailing_class_prerequisites" ADD CONSTRAINT "sailing_class_prerequisites_prerequisite_class_id_fkey" FOREIGN KEY ("prerequisite_class_id") REFERENCES "sailing_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sailing_class_unlocked_boats" ADD CONSTRAINT "sailing_class_unlocked_boats_sailing_class_id_fkey" FOREIGN KEY ("sailing_class_id") REFERENCES "sailing_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sailing_class_unlocked_boats" ADD CONSTRAINT "sailing_class_unlocked_boats_fleet_boat_id_fkey" FOREIGN KEY ("fleet_boat_id") REFERENCES "fleet_boats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "sailing_class_unlocked_boats_fleet_boat_id_idx" ON "sailing_class_unlocked_boats"("fleet_boat_id");
