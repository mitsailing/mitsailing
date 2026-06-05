CREATE TYPE "learn_to_sail_managed_class_kind" AS ENUM (
    'none',
    'beginner_mid_week_123',
    'beginner_sunday_all_in_one'
);

CREATE TYPE "learn_to_sail_waitlist_entry_status" AS ENUM (
    'active',
    'left',
    'closed_by_tech_rating',
    'closed_by_account_deletion',
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

ALTER TABLE "events"
ADD CONSTRAINT "events_learn_to_sail_managed_standard_approval"
CHECK (
    "learn_to_sail_managed_class_kind" = 'none' OR
    ("registration_mode" = 'standard' AND "requires_approval" = true)
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
