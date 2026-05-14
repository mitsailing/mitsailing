ALTER TABLE "newsletter_broadcasts"
ADD COLUMN "scheduled_at" TIMESTAMP(3),
ADD COLUMN "started_at" TIMESTAMP(3),
ADD COLUMN "paused_at" TIMESTAMP(3),
ADD COLUMN "cancelled_at" TIMESTAMP(3);

CREATE INDEX "newsletter_broadcasts_status_scheduled_at_idx" ON "newsletter_broadcasts"("status", "scheduled_at") WHERE "scheduled_at" IS NOT NULL;
