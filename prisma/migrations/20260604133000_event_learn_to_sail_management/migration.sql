CREATE TYPE "learn_to_sail_managed_class_kind" AS ENUM (
    'none',
    'beginner_mid_week_123',
    'beginner_sunday_all_in_one'
);

ALTER TABLE "events"
  ADD COLUMN "learn_to_sail_managed_class_kind" "learn_to_sail_managed_class_kind" NOT NULL DEFAULT 'none',
  ADD COLUMN "selection_note" VARCHAR(160);

ALTER TABLE "events"
ADD CONSTRAINT "events_learn_to_sail_managed_standard_approval"
CHECK (
    "learn_to_sail_managed_class_kind" = 'none' OR
    ("registration_mode" = 'standard' AND "requires_approval" = true)
);
