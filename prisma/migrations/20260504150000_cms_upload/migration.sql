-- Admin CMS binary uploads (local disk; metadata for audit and GET serving).

CREATE TABLE "uploads" (
    "id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploaded_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scan_status" TEXT NOT NULL DEFAULT 'not_scanned',

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uploads_storage_key_key" ON "uploads"("storage_key");

CREATE INDEX "uploads_uploaded_by_user_id_idx" ON "uploads"("uploaded_by_user_id");

CREATE INDEX "uploads_created_at_idx" ON "uploads"("created_at");

ALTER TABLE "uploads" ADD CONSTRAINT "uploads_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
