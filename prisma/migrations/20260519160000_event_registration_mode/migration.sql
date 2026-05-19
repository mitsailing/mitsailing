CREATE TYPE "EventRegistrationMode" AS ENUM ('none', 'standard', 'external');

ALTER TABLE "events"
  ADD COLUMN "registration_mode" "EventRegistrationMode" NOT NULL DEFAULT 'standard',
  ADD COLUMN "external_registration_url" TEXT,
  ADD COLUMN "external_entries_url" TEXT;
