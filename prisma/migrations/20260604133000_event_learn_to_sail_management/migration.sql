CREATE TYPE "learn_to_sail_managed_class_kind" AS ENUM (
    'none',
    'beginner_mid_week_123',
    'beginner_sunday_all_in_one'
);

CREATE TYPE "learn_to_sail_waitlist_entry_status" AS ENUM (
    'active',
    'left',
    'closed_by_tech_rating',
    'expired'
);

ALTER TABLE "events"
  ADD COLUMN "learn_to_sail_managed_class_kind" "learn_to_sail_managed_class_kind" NOT NULL DEFAULT 'none',
  ADD COLUMN "selection_note" VARCHAR(160);

CREATE TABLE "learn_to_sail_waitlist_entries" (
    "id" TEXT NOT NULL,
    "season_year" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "active_entry_key" TEXT,
    "sequence" INTEGER NOT NULL,
    "status" "learn_to_sail_waitlist_entry_status" NOT NULL DEFAULT 'active',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "closure_reason" TEXT,

    CONSTRAINT "learn_to_sail_waitlist_entries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "event_registrations"
  ADD COLUMN "learn_to_sail_waitlist_entry_id" TEXT,
  ADD COLUMN "learn_to_sail_audit_position_at_request" INTEGER;

ALTER TABLE "payments"
  DROP CONSTRAINT "payments_registration_id_event_id_user_id_fkey",
  DROP CONSTRAINT "payments_user_id_fkey";

ALTER TABLE "events"
ADD CONSTRAINT "events_learn_to_sail_managed_standard_approval"
CHECK (
    "learn_to_sail_managed_class_kind" = 'none' OR
    ("registration_mode" = 'standard' AND "requires_approval" = true)
);

ALTER TABLE "learn_to_sail_waitlist_entries"
ADD CONSTRAINT "learn_to_sail_waitlist_entries_sequence_positive"
CHECK ("sequence" > 0);

ALTER TABLE "learn_to_sail_waitlist_entries"
ADD CONSTRAINT "learn_to_sail_waitlist_entries_active_consistency"
CHECK (
    (
        "status" = 'active' AND
        "active_entry_key" IS NOT NULL AND
        "closed_at" IS NULL
    ) OR (
        "status" <> 'active' AND
        "active_entry_key" IS NULL AND
        "closed_at" IS NOT NULL
    )
);

ALTER TABLE "event_registrations"
ADD CONSTRAINT "event_registrations_lts_audit_position_positive"
CHECK (
    "learn_to_sail_audit_position_at_request" IS NULL OR
    "learn_to_sail_audit_position_at_request" > 0
);

CREATE UNIQUE INDEX "learn_to_sail_waitlist_entries_active_entry_key_key"
ON "learn_to_sail_waitlist_entries"("active_entry_key");

CREATE UNIQUE INDEX "learn_to_sail_waitlist_entries_one_active_user_season_key"
ON "learn_to_sail_waitlist_entries"("user_id", "season_year")
WHERE "status" = 'active';

CREATE UNIQUE INDEX "learn_to_sail_waitlist_entries_season_year_sequence_key"
ON "learn_to_sail_waitlist_entries"("season_year", "sequence");

CREATE INDEX "learn_to_sail_waitlist_entries_season_year_status_sequence_idx"
ON "learn_to_sail_waitlist_entries"("season_year", "status", "sequence");

CREATE INDEX "learn_to_sail_waitlist_entries_user_id_season_year_idx"
ON "learn_to_sail_waitlist_entries"("user_id", "season_year");

CREATE INDEX "event_registrations_learn_to_sail_waitlist_entry_id_idx"
ON "event_registrations"("learn_to_sail_waitlist_entry_id");

ALTER TABLE "learn_to_sail_waitlist_entries"
ADD CONSTRAINT "learn_to_sail_waitlist_entries_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_registrations"
ADD CONSTRAINT "event_registrations_learn_to_sail_waitlist_entry_id_fkey"
FOREIGN KEY ("learn_to_sail_waitlist_entry_id") REFERENCES "learn_to_sail_waitlist_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments"
ADD CONSTRAINT "payments_registration_id_event_id_user_id_fkey"
FOREIGN KEY ("registration_id", "event_id", "user_id") REFERENCES "event_registrations"("id", "event_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payments"
ADD CONSTRAINT "payments_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION user_account_deletion_privacy_cleanup()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "audit_log"
  SET
    "user_id" = NULL,
    "ip_address" = NULL,
    "user_agent" = NULL,
    "metadata" = NULL
  WHERE "user_id" = OLD."id";

  UPDATE "user_audit"
  SET
    "user_id" = NULL,
    "impersonated_user_id" = NULL,
    "remote_address" = NULL
  WHERE "user_id" = OLD."id"
    OR "impersonated_user_id" = OLD."id";

  DELETE FROM "user_audit"
  WHERE "auditable_type" = 'user'
    AND "auditable_id" = OLD."id";

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_account_deletion_privacy_cleanup_trigger
BEFORE DELETE ON "user"
FOR EACH ROW
EXECUTE FUNCTION user_account_deletion_privacy_cleanup();
