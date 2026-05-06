-- Store whole-row catalog snapshots for version view/compare/restore.

ALTER TABLE "catalog_change_logs"
  ADD COLUMN "snapshot" JSONB;
