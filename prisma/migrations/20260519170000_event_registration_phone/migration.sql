ALTER TABLE "events"
  ADD COLUMN "requires_phone" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "event_registrations"
  ADD COLUMN "phone" TEXT;
