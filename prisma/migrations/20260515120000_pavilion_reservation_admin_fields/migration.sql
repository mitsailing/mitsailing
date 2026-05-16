ALTER TYPE "pavilion_reservation_status" ADD VALUE IF NOT EXISTS 'needs_info';

CREATE TYPE "pavilion_reservation_payment_status" AS ENUM (
  'unpaid',
  'partial',
  'paid',
  'waived'
);

ALTER TABLE "pavilion_reservation_requests"
  ADD COLUMN "payment_status" "pavilion_reservation_payment_status" NOT NULL DEFAULT 'unpaid',
  ADD COLUMN "paid_at" TIMESTAMP(3);
