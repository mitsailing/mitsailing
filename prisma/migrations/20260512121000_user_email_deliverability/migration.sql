ALTER TABLE "user"
  ADD COLUMN "email_bounced_at" TIMESTAMP(3),
  ADD COLUMN "email_suppressed_at" TIMESTAMP(3),
  ADD COLUMN "email_suppression_reason" TEXT;

CREATE INDEX "user_email_suppressed_at_idx" ON "user"("email_suppressed_at");
CREATE INDEX "user_email_bounced_at_idx" ON "user"("email_bounced_at");
