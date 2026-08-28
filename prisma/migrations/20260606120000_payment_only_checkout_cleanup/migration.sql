-- Remove active deposit and subscription structures from the payment-only checkout slice.

DELETE FROM "sailing_card_membership_prices"
WHERE "billing_interval" = 'annual';

ALTER TABLE "sailing_card_membership_prices"
  DROP CONSTRAINT IF EXISTS "sailing_card_membership_prices_one_time_billing_interval_chk";
ALTER TABLE "sailing_card_membership_prices"
  ADD CONSTRAINT "sailing_card_membership_prices_one_time_billing_interval_chk"
  CHECK ("billing_interval" = 'one_time');

DROP TRIGGER IF EXISTS payments_prevent_classification_change_trigger
  ON "payments";

CREATE OR REPLACE FUNCTION payments_prevent_classification_change()
RETURNS trigger AS $$
BEGIN
  IF NEW."purpose" IS DISTINCT FROM OLD."purpose"
    OR NEW."source" IS DISTINCT FROM OLD."source"
    OR NEW."card_type" IS DISTINCT FROM OLD."card_type" THEN
    RAISE EXCEPTION 'payment classification fields are immutable after create';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_prevent_classification_change_trigger
  BEFORE UPDATE OF "purpose", "source", "card_type"
  ON "payments"
  FOR EACH ROW
  EXECUTE FUNCTION payments_prevent_classification_change();

ALTER TABLE "payments"
  DROP CONSTRAINT IF EXISTS "payments_non_stripe_no_stripe_fields_chk",
  DROP CONSTRAINT IF EXISTS "payments_membership_subscription_id_fkey",
  DROP CONSTRAINT IF EXISTS "payments_membership_renewal_price_id_fkey";

DROP INDEX IF EXISTS "payments_membership_subscription_id_created_at_idx";
DROP INDEX IF EXISTS "payments_stripe_subscription_id_stripe_invoice_id_idx";
DROP INDEX IF EXISTS "payments_stripe_subscription_id_key";
DROP INDEX IF EXISTS "payments_stripe_invoice_id_key";

DROP TABLE IF EXISTS "sailing_card_subscriptions" CASCADE;

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "amount_paid_cents" INTEGER,
  ADD COLUMN IF NOT EXISTS "stripe_discount_metadata" JSONB,
  DROP COLUMN IF EXISTS "membership_subscription_id",
  DROP COLUMN IF EXISTS "membership_payment_kind",
  DROP COLUMN IF EXISTS "membership_renewal_price_id",
  DROP COLUMN IF EXISTS "stripe_subscription_id",
  DROP COLUMN IF EXISTS "stripe_invoice_id",
  DROP COLUMN IF EXISTS "stripe_invoice_line_item_id",
  DROP COLUMN IF EXISTS "stripe_hosted_invoice_url",
  DROP COLUMN IF EXISTS "stripe_invoice_pdf_url",
  DROP COLUMN IF EXISTS "duplicate_stripe_subscription_id",
  DROP COLUMN IF EXISTS "last_stripe_invoice_event_id",
  DROP COLUMN IF EXISTS "last_stripe_invoice_event_created_at";

ALTER TABLE "payments"
  DROP CONSTRAINT IF EXISTS "payments_amount_paid_cents_chk",
  ADD CONSTRAINT "payments_amount_paid_cents_chk" CHECK (
    "amount_paid_cents" IS NULL
    OR (
      "amount_paid_cents" >= 0
      AND "amount_paid_cents" <= "amount_cents"
    )
  );

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_non_stripe_no_stripe_fields_chk" CHECK (
    "source" NOT IN ('legacy', 'admin_override')
    OR (
      "stripe_customer_id" IS NULL
      AND "stripe_checkout_session_id" IS NULL
      AND "stripe_checkout_session_client_secret" IS NULL
      AND "stripe_checkout_session_url" IS NULL
      AND "stripe_checkout_session_expires_at" IS NULL
      AND "stripe_payment_intent_id" IS NULL
      AND "stripe_charge_id" IS NULL
      AND "stripe_discount_metadata" IS NULL
      AND "stripe_refund_id" IS NULL
      AND "stripe_dispute_id" IS NULL
      AND "stripe_receipt_url" IS NULL
      AND "last_stripe_payment_event_id" IS NULL
      AND "last_stripe_payment_event_created_at" IS NULL
    )
  );

ALTER TABLE "event_entry_fees"
  DROP COLUMN IF EXISTS "is_deposit";

ALTER TABLE "sailing_card_requests"
  DROP CONSTRAINT IF EXISTS "sailing_card_requests_payment_bypass_by_user_id_fkey",
  DROP CONSTRAINT IF EXISTS "sailing_card_requests_payment_bypass_note_chk";

DROP INDEX IF EXISTS "sailing_card_requests_payment_bypass_by_user_id_idx";

ALTER TABLE "sailing_card_requests"
  DROP COLUMN IF EXISTS "payment_bypass_note",
  DROP COLUMN IF EXISTS "payment_bypass_by_user_id",
  DROP COLUMN IF EXISTS "payment_bypass_at";

DROP TYPE IF EXISTS "membership_payment_kind";
DROP TYPE IF EXISTS "sailing_card_subscription_status";
DROP TYPE IF EXISTS "membership_cancellation_reason";
