-- Catalog editor metadata and durable recent-change attribution.

CREATE TABLE "catalog_change_logs" (
  "id" TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "row_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "catalog_change_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "catalog_change_logs"
  ADD CONSTRAINT "catalog_change_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "catalog_change_logs_resource_id_row_id_created_at_idx"
  ON "catalog_change_logs"("resource_id", "row_id", "created_at");

CREATE INDEX "catalog_change_logs_user_id_idx"
  ON "catalog_change_logs"("user_id");

ALTER TABLE "sailing_classes"
  ADD COLUMN "created_by" TEXT,
  ADD COLUMN "updated_by" TEXT,
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "fleet_boats"
  ADD COLUMN "created_by" TEXT,
  ADD COLUMN "updated_by" TEXT,
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "sailing_classes"
SET
  "created_by" = COALESCE(
    (SELECT "id" FROM "user" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1),
    (SELECT "id" FROM "user" ORDER BY "created_at" ASC LIMIT 1)
  ),
  "updated_by" = COALESCE(
    (SELECT "id" FROM "user" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1),
    (SELECT "id" FROM "user" ORDER BY "created_at" ASC LIMIT 1)
  );

UPDATE "fleet_boats"
SET
  "created_by" = COALESCE(
    (SELECT "id" FROM "user" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1),
    (SELECT "id" FROM "user" ORDER BY "created_at" ASC LIMIT 1)
  ),
  "updated_by" = COALESCE(
    (SELECT "id" FROM "user" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1),
    (SELECT "id" FROM "user" ORDER BY "created_at" ASC LIMIT 1)
  );

ALTER TABLE "sailing_classes"
  ALTER COLUMN "created_by" SET NOT NULL,
  ALTER COLUMN "updated_by" SET NOT NULL;

ALTER TABLE "fleet_boats"
  ALTER COLUMN "created_by" SET NOT NULL,
  ALTER COLUMN "updated_by" SET NOT NULL;

ALTER TABLE "sailing_classes"
  ADD CONSTRAINT "sailing_classes_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sailing_classes"
  ADD CONSTRAINT "sailing_classes_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fleet_boats"
  ADD CONSTRAINT "fleet_boats_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fleet_boats"
  ADD CONSTRAINT "fleet_boats_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "sailing_classes_created_by_idx"
  ON "sailing_classes"("created_by");

CREATE INDEX "sailing_classes_updated_by_idx"
  ON "sailing_classes"("updated_by");

CREATE INDEX "fleet_boats_created_by_idx"
  ON "fleet_boats"("created_by");

CREATE INDEX "fleet_boats_updated_by_idx"
  ON "fleet_boats"("updated_by");
