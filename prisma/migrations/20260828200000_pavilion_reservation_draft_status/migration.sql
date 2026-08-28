-- AlterEnum
ALTER TYPE "pavilion_reservation_status" ADD VALUE 'draft';

-- AlterTable
ALTER TABLE "pavilion_reservation_requests"
ADD COLUMN "resume_token" TEXT,
ADD COLUMN "abandon_email_sent_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "pavilion_reservation_requests_resume_token_key"
ON "pavilion_reservation_requests"("resume_token");
