UPDATE "event_registrations"
SET "phone" = 'Unknown'
WHERE "phone" IS NULL OR btrim("phone") = '';

ALTER TABLE "event_registrations"
  ALTER COLUMN "phone" SET NOT NULL;

ALTER TABLE "event_registrations"
  ADD CONSTRAINT "event_registrations_phone_not_blank"
  CHECK (btrim("phone") <> '');
