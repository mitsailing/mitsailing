ALTER TYPE "event_payment_status" RENAME TO "payment_status";

ALTER TYPE "payment_status" ADD VALUE IF NOT EXISTS 'needs_review';

CREATE TYPE "payment_purpose" AS ENUM (
  'event',
  'membership'
);

CREATE TYPE "payment_source" AS ENUM (
  'stripe',
  'legacy',
  'admin_override'
);

ALTER TABLE "event_payments" RENAME TO "payments";
ALTER TABLE "payments" RENAME CONSTRAINT "event_payments_pkey" TO "payments_pkey";
ALTER TABLE "payments" RENAME CONSTRAINT "event_payments_event_id_fkey" TO "payments_event_id_fkey";
ALTER TABLE "payments" RENAME CONSTRAINT "event_payments_registration_id_event_id_user_id_fkey" TO "payments_registration_id_event_id_user_id_fkey";
ALTER TABLE "payments" RENAME CONSTRAINT "event_payments_user_id_fkey" TO "payments_user_id_fkey";
ALTER TABLE "payments" RENAME CONSTRAINT "event_payments_event_id_selected_fee_id_fkey" TO "payments_event_id_selected_fee_id_fkey";
ALTER TABLE "payments" RENAME CONSTRAINT "event_payments_manual_handled_by_user_id_fkey" TO "payments_manual_handled_by_user_id_fkey";

ALTER INDEX "event_payments_registration_id_key" RENAME TO "payments_registration_id_key";
ALTER INDEX "event_payments_stripe_customer_id_idx" RENAME TO "payments_stripe_customer_id_idx";
ALTER INDEX "event_payments_stripe_checkout_session_id_key" RENAME TO "payments_stripe_checkout_session_id_key";
ALTER INDEX "event_payments_stripe_payment_intent_id_key" RENAME TO "payments_stripe_payment_intent_id_key";
ALTER INDEX "event_payments_stripe_charge_id_key" RENAME TO "payments_stripe_charge_id_key";
ALTER INDEX "event_payments_event_id_status_idx" RENAME TO "payments_event_id_status_idx";
ALTER INDEX "event_payments_user_id_created_at_idx" RENAME TO "payments_user_id_created_at_idx";
ALTER INDEX "event_payments_selected_fee_id_idx" RENAME TO "payments_selected_fee_id_idx";
ALTER INDEX "event_payments_manual_handled_by_user_id_idx" RENAME TO "payments_manual_handled_by_user_id_idx";
ALTER INDEX "event_payments_registration_id_event_id_user_id_key" RENAME TO "payments_registration_id_event_id_user_id_key";

ALTER TABLE "event_payment_notifications"
  DROP CONSTRAINT "event_payment_notifications_payment_id_fkey",
  ADD CONSTRAINT "event_payment_notifications_payment_id_fkey"
  FOREIGN KEY ("payment_id")
  REFERENCES "payments"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD COLUMN "purpose" "payment_purpose" NOT NULL DEFAULT 'event',
  ADD COLUMN "source" "payment_source" NOT NULL DEFAULT 'stripe',
  ADD COLUMN "card_year" INTEGER,
  ADD COLUMN "card_type" "sailing_card_type",
  ADD COLUMN "legacy_source_table" TEXT,
  ADD COLUMN "legacy_source_id" TEXT,
  ADD COLUMN "legacy_category" TEXT,
  ADD COLUMN "legacy_description" TEXT,
  ADD COLUMN "legacy_settled" BOOLEAN,
  ADD COLUMN "payer_name" TEXT,
  ADD COLUMN "payer_email" TEXT,
  ADD COLUMN "stripe_subscription_id" TEXT,
  ADD COLUMN "stripe_invoice_id" TEXT;

ALTER TABLE "payments"
  ALTER COLUMN "event_id" DROP NOT NULL,
  ALTER COLUMN "registration_id" DROP NOT NULL,
  ALTER COLUMN "user_id" DROP NOT NULL,
  ALTER COLUMN "selected_fee_id" DROP NOT NULL,
  ALTER COLUMN "selected_fee_description" DROP NOT NULL,
  ALTER COLUMN "status" TYPE "payment_status" USING "status"::text::"payment_status";

ALTER TABLE "payments"
  DROP CONSTRAINT IF EXISTS "event_payments_amount_cents_check",
  DROP CONSTRAINT IF EXISTS "payments_amount_cents_check",
  ADD CONSTRAINT "payments_amount_cents_check" CHECK ("amount_cents" >= 0),
  ADD CONSTRAINT "payments_event_fields_chk" CHECK (
    "purpose" <> 'event'
    OR "source" = 'legacy'
    OR (
      "event_id" IS NOT NULL
      AND "registration_id" IS NOT NULL
      AND "user_id" IS NOT NULL
      AND "selected_fee_id" IS NOT NULL
      AND "selected_fee_description" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "payments_membership_fields_chk" CHECK (
    "purpose" <> 'membership'
    OR (
      "event_id" IS NULL
      AND "registration_id" IS NULL
      AND "user_id" IS NOT NULL
      AND "selected_fee_id" IS NULL
      AND "selected_fee_description" IS NULL
      AND "card_year" IS NOT NULL
      AND "card_type" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "payments_non_stripe_no_stripe_fields_chk" CHECK (
    "source" NOT IN ('legacy', 'admin_override')
    OR (
      "stripe_customer_id" IS NULL
      AND "stripe_checkout_session_id" IS NULL
      AND "stripe_payment_intent_id" IS NULL
      AND "stripe_charge_id" IS NULL
      AND "stripe_subscription_id" IS NULL
      AND "stripe_invoice_id" IS NULL
      AND "stripe_receipt_url" IS NULL
    )
  ),
  ADD CONSTRAINT "payments_legacy_fields_chk" CHECK (
    "source" <> 'legacy'
    OR (
      "legacy_source_table" IS NOT NULL
      AND length(trim("legacy_source_table")) >= 1
      AND "legacy_source_id" IS NOT NULL
      AND length(trim("legacy_source_id")) >= 1
      AND "legacy_category" IS NOT NULL
      AND length(trim("legacy_category")) >= 1
      AND "legacy_description" IS NOT NULL
      AND length(trim("legacy_description")) >= 1
      AND "legacy_settled" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "payments_non_legacy_no_legacy_fields_chk" CHECK (
    "source" = 'legacy'
    OR (
      "legacy_source_table" IS NULL
      AND "legacy_source_id" IS NULL
      AND "legacy_category" IS NULL
      AND "legacy_description" IS NULL
      AND "legacy_settled" IS NULL
      AND "payer_name" IS NULL
      AND "payer_email" IS NULL
    )
  ),
  ADD CONSTRAINT "payments_admin_override_zero_amount_chk" CHECK (
    "source" <> 'admin_override'
    OR (
      "amount_cents" = 0
      AND "manual_handled_note" IS NOT NULL
      AND length(trim("manual_handled_note")) >= 1
      AND "manual_handled_by_user_id" IS NOT NULL
      AND "manual_handled_at" IS NOT NULL
      AND "user_id" IS NOT NULL
    )
  );

CREATE INDEX "payments_purpose_status_idx" ON "payments"("purpose", "status");
CREATE INDEX "payments_card_year_card_type_status_idx" ON "payments"("card_year", "card_type", "status");
CREATE UNIQUE INDEX "payments_legacy_source_table_legacy_source_id_key" ON "payments"("legacy_source_table", "legacy_source_id");
CREATE UNIQUE INDEX "payments_stripe_subscription_id_key" ON "payments"("stripe_subscription_id");
CREATE UNIQUE INDEX "payments_stripe_invoice_id_key" ON "payments"("stripe_invoice_id");

ALTER TABLE "sailing_card_requests"
  ADD COLUMN "payment_bypass_note" TEXT,
  ADD COLUMN "payment_bypass_by_user_id" TEXT,
  ADD COLUMN "payment_bypass_at" TIMESTAMP(3);

CREATE INDEX "sailing_card_requests_payment_bypass_by_user_id_idx"
  ON "sailing_card_requests"("payment_bypass_by_user_id");

ALTER TABLE "sailing_card_requests"
  ADD CONSTRAINT "sailing_card_requests_payment_bypass_by_user_id_fkey"
  FOREIGN KEY ("payment_bypass_by_user_id")
  REFERENCES "user"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE,
  ADD CONSTRAINT "sailing_card_requests_payment_bypass_note_chk"
  CHECK (
    "payment_bypass_at" IS NULL
    OR (
      "payment_bypass_note" IS NOT NULL
      AND length(trim("payment_bypass_note")) >= 3
    )
  );

CREATE UNIQUE INDEX "sailing_card_requests_card_year_issued_card_number_key"
  ON "sailing_card_requests"("card_year", "issued_card_number");
