ALTER TABLE "event_categories"
  ADD COLUMN "legacy_event_type" TEXT;

ALTER TABLE "events"
  ADD COLUMN "legacy_event_id" TEXT;

ALTER TABLE "event_registrations"
  ADD COLUMN "legacy_source_key" TEXT;

ALTER TABLE "event_registration_boat_members"
  ADD COLUMN "legacy_source_key" TEXT;

ALTER TABLE "event_entry_fees"
  ADD COLUMN "legacy_source_key" TEXT;

ALTER TABLE "sailing_ratings"
  ADD COLUMN "legacy_rating_type" TEXT;

ALTER TABLE "site_alerts"
  ADD COLUMN "legacy_news_id" TEXT;

CREATE UNIQUE INDEX "event_categories_legacy_event_type_key"
  ON "event_categories"("legacy_event_type");

CREATE UNIQUE INDEX "events_legacy_event_id_key"
  ON "events"("legacy_event_id");

CREATE UNIQUE INDEX "event_registrations_legacy_source_key_key"
  ON "event_registrations"("legacy_source_key");

CREATE UNIQUE INDEX "event_registration_boat_members_legacy_source_key_key"
  ON "event_registration_boat_members"("legacy_source_key");

CREATE UNIQUE INDEX "event_entry_fees_legacy_source_key_key"
  ON "event_entry_fees"("legacy_source_key");

CREATE UNIQUE INDEX "sailing_ratings_legacy_rating_type_key"
  ON "sailing_ratings"("legacy_rating_type");

CREATE UNIQUE INDEX "site_alerts_legacy_news_id_key"
  ON "site_alerts"("legacy_news_id");
