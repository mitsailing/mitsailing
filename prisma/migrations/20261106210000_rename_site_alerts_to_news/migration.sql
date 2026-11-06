-- Rename site_alerts to news; drop legacy news import key.
DROP INDEX IF EXISTS "site_alerts_legacy_news_id_key";

ALTER TABLE "site_alerts" DROP COLUMN IF EXISTS "legacy_news_id";

ALTER TABLE "site_alerts" RENAME TO "news";

ALTER INDEX "site_alerts_pkey" RENAME TO "news_pkey";

ALTER INDEX "site_alerts_is_published_start_date_idx" RENAME TO "news_is_published_start_date_idx";
