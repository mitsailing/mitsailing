ALTER TABLE "user"
  ADD COLUMN "email_bounced_at" TIMESTAMP(3),
  ADD COLUMN "email_suppressed_at" TIMESTAMP(3),
  ADD COLUMN "email_suppression_reason" TEXT;

ALTER TABLE "user"
  ADD CONSTRAINT "user_email_suppression_reason_check"
  CHECK ("email_suppression_reason" IS NULL OR "email_suppressed_at" IS NOT NULL);

DROP INDEX IF EXISTS "user_email_suppressed_at_idx";
DROP INDEX IF EXISTS "user_email_bounced_at_idx";

CREATE INDEX IF NOT EXISTS "user_email_suppressed_at_idx" ON "user"("email_suppressed_at") WHERE "email_suppressed_at" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "user_email_bounced_at_idx" ON "user"("email_bounced_at") WHERE "email_bounced_at" IS NOT NULL;
