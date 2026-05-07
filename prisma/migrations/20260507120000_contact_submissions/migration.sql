CREATE TYPE "ContactSubmissionStatus" AS ENUM ('unread', 'resolved', 'archived');

CREATE TYPE "ContactSubmissionNotificationStatus" AS ENUM ('pending', 'sending', 'sent', 'failed');

CREATE TABLE "contact_submissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ContactSubmissionStatus" NOT NULL DEFAULT 'unread',
    "notification_status" "ContactSubmissionNotificationStatus" NOT NULL DEFAULT 'pending',
    "notification_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "notified_at" TIMESTAMP(3),
    "notification_error" TEXT,
    "submitted_by_user_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contact_submissions_notification_attempt_count_check" CHECK ("notification_attempt_count" >= 0)
);

CREATE OR REPLACE FUNCTION "update_contact_submissions_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updated_at" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "update_contact_submissions_updated_at"
BEFORE UPDATE ON "contact_submissions"
FOR EACH ROW
EXECUTE FUNCTION "update_contact_submissions_updated_at"();

CREATE INDEX "contact_submissions_status_created_at_idx" ON "contact_submissions"("status", "created_at");
CREATE INDEX "contact_submissions_notification_status_created_at_idx" ON "contact_submissions"("notification_status", "created_at");
CREATE INDEX "contact_submissions_email_idx" ON "contact_submissions"("email");
CREATE INDEX "contact_submissions_submitted_by_user_id_idx" ON "contact_submissions"("submitted_by_user_id");

ALTER TABLE "contact_submissions" ADD CONSTRAINT "contact_submissions_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
