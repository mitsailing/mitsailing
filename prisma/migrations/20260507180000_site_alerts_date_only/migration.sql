-- Site alerts: single body field window as DATE (Eastern calendar day migration from timestamps)

ALTER TABLE "site_alerts" DROP COLUMN "title";

ALTER TABLE "site_alerts" ALTER COLUMN "banner_visible_from" TYPE DATE USING (
  timezone('America/New_York', "banner_visible_from")::date
);

ALTER TABLE "site_alerts" ALTER COLUMN "banner_visible_until" TYPE DATE USING (
  CASE
    WHEN "banner_visible_until" IS NULL THEN NULL
    ELSE timezone('America/New_York', "banner_visible_until")::date
  END
);

ALTER TABLE "site_alerts" RENAME COLUMN "banner_visible_from" TO "alert_date";

ALTER TABLE "site_alerts" RENAME COLUMN "banner_visible_until" TO "last_show_date";

DROP INDEX IF EXISTS "site_alerts_is_published_display_order_banner_visible_from_idx";

CREATE INDEX "site_alerts_is_published_display_order_alert_date_idx" ON "site_alerts"("is_published", "display_order", "alert_date");
