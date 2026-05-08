-- Site alerts: start_date / last_date naming; last_date required; drop banner priority

ALTER TABLE "site_alerts" RENAME COLUMN "alert_date" TO "start_date";

ALTER TABLE "site_alerts" RENAME COLUMN "last_show_date" TO "last_date";

UPDATE "site_alerts" SET "last_date" = "start_date" WHERE "last_date" IS NULL;

ALTER TABLE "site_alerts" ALTER COLUMN "last_date" SET NOT NULL;

ALTER TABLE "site_alerts" DROP COLUMN "display_order";

DROP INDEX IF EXISTS "site_alerts_is_published_display_order_alert_date_idx";

CREATE INDEX "site_alerts_is_published_start_date_idx" ON "site_alerts"("is_published", "start_date");
