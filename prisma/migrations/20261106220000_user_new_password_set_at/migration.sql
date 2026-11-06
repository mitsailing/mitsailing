-- Track the first new-site password. Null means the sailor still needs the
-- go-live create-password flow (legacy imports have no credential account).
ALTER TABLE "user"
  ADD COLUMN "new_password_set_at" TIMESTAMP(3);

-- Users who already created a credential password on this site have completed
-- that lifecycle. Do not backfill users without a credential password.
UPDATE "user" AS u
SET "new_password_set_at" = NOW()
WHERE u."new_password_set_at" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "account" AS a
    WHERE a."user_id" = u."id"
      AND a."provider_id" = 'credential'
      AND a."password" IS NOT NULL
  );
