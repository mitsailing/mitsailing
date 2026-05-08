ALTER TABLE "site_alerts"
  DROP CONSTRAINT IF EXISTS "site_alerts_created_by_fkey",
  DROP CONSTRAINT IF EXISTS "site_alerts_updated_by_fkey",
  DROP COLUMN IF EXISTS "created_by",
  DROP COLUMN IF EXISTS "updated_by";
