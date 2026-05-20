ALTER TABLE "user"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "emergency_contact_name" TEXT,
  ADD COLUMN "emergency_contact_phone" TEXT;

ALTER TABLE "user"
  ADD CONSTRAINT "user_phone_e164_us"
  CHECK ("phone" IS NULL OR "phone" ~ '^\+1[0-9]{10}$');

ALTER TABLE "user"
  ADD CONSTRAINT "user_emergency_contact_phone_e164"
  CHECK (
    "emergency_contact_phone" IS NULL OR
    "emergency_contact_phone" ~ '^\+[1-9][0-9]{1,14}$'
  );

ALTER TABLE "user"
  ADD CONSTRAINT "user_emergency_contact_complete"
  CHECK (
    ("emergency_contact_name" IS NULL AND "emergency_contact_phone" IS NULL) OR
    ("emergency_contact_name" IS NOT NULL AND btrim("emergency_contact_name") <> '' AND "emergency_contact_phone" IS NOT NULL)
  );
