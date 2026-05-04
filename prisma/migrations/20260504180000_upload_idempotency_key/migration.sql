-- AlterTable
ALTER TABLE "uploads" ADD COLUMN "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "uploads_uploaded_by_idempotency_key_key" ON "uploads"("uploaded_by_user_id", "idempotency_key");
