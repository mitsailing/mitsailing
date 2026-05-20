DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "event_registrations"
    WHERE "phone" IS NULL OR btrim("phone") = ''
  ) THEN
    RAISE EXCEPTION
      'event_registrations.phone contains NULL/blank values; remediate rows before enforcing NOT NULL';
  END IF;
END
$$;

ALTER TABLE "event_registrations"
  ALTER COLUMN "phone" SET NOT NULL;

ALTER TABLE "event_registrations"
  ADD CONSTRAINT "event_registrations_phone_not_blank"
  CHECK (length(btrim("phone")) > 0);
