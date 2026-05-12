ALTER TABLE "sailing_classes"
  DROP CONSTRAINT IF EXISTS "sailing_classes_created_by_fkey",
  DROP CONSTRAINT IF EXISTS "sailing_classes_updated_by_fkey",
  DROP COLUMN IF EXISTS "created_by",
  DROP COLUMN IF EXISTS "updated_by";

ALTER TABLE "fleet_boats"
  DROP CONSTRAINT IF EXISTS "fleet_boats_created_by_fkey",
  DROP CONSTRAINT IF EXISTS "fleet_boats_updated_by_fkey",
  DROP COLUMN IF EXISTS "created_by",
  DROP COLUMN IF EXISTS "updated_by";
