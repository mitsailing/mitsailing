-- Composite target so child rows can FK (item_id, item_kind) to catalog (id, kind).
CREATE UNIQUE INDEX "pavilion_reservable_items_id_kind_key" ON "pavilion_reservable_items" ("id", "kind");

-- Denormalized kind + composite FKs enforce space vs service at the database.
ALTER TABLE "pavilion_reservation_slots"
  ADD COLUMN "item_kind" "pavilion_reservable_item_kind";

UPDATE "pavilion_reservation_slots" AS s
SET "item_kind" = i."kind"
FROM "pavilion_reservable_items" AS i
WHERE i."id" = s."item_id";

ALTER TABLE "pavilion_reservation_slots"
  ALTER COLUMN "item_kind" SET NOT NULL;

ALTER TABLE "pavilion_reservation_services"
  ADD COLUMN "item_kind" "pavilion_reservable_item_kind";

UPDATE "pavilion_reservation_services" AS s
SET "item_kind" = i."kind"
FROM "pavilion_reservable_items" AS i
WHERE i."id" = s."item_id";

ALTER TABLE "pavilion_reservation_services"
  ALTER COLUMN "item_kind" SET NOT NULL;

ALTER TABLE "pavilion_reservation_slots"
  DROP CONSTRAINT "pavilion_reservation_slots_item_id_fkey";

ALTER TABLE "pavilion_reservation_services"
  DROP CONSTRAINT "pavilion_reservation_services_item_id_fkey";

ALTER TABLE "pavilion_reservation_slots"
  ADD CONSTRAINT "pavilion_reservation_slots_item_id_item_kind_fkey"
  FOREIGN KEY ("item_id", "item_kind") REFERENCES "pavilion_reservable_items" ("id", "kind") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "pavilion_reservation_slots_item_kind_check"
  CHECK ("item_kind" = 'space');

ALTER TABLE "pavilion_reservation_services"
  ADD CONSTRAINT "pavilion_reservation_services_item_id_item_kind_fkey"
  FOREIGN KEY ("item_id", "item_kind") REFERENCES "pavilion_reservable_items" ("id", "kind") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "pavilion_reservation_services_item_kind_check"
  CHECK ("item_kind" = 'service');
