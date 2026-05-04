-- Catalog visibility: hide fleet rows from public listings while keeping admin data.
ALTER TABLE "fleet_boats" ADD COLUMN "is_visible" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "fleet_boats_is_visible_display_order_idx" ON "fleet_boats" ("is_visible", "display_order");
