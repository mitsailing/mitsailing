CREATE TYPE "membership_payment_kind" AS ENUM ('initial', 'renewal');

CREATE TYPE "sailing_card_subscription_status" AS ENUM (
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
  'duplicate'
);

CREATE TYPE "membership_payment_issue_kind" AS ENUM (
  'failed_payment',
  'duplicate_subscription',
  'refunded_current_season',
  'disputed_current_season',
  'needs_manual_review'
);

CREATE TYPE "membership_cancellation_reason" AS ENUM (
  'not_sailing_next_season',
  'using_free_membership',
  'cost',
  'duplicate_or_mistake',
  'other'
);

ALTER TABLE "payments"
  DROP CONSTRAINT IF EXISTS "payments_stripe_subscription_id_key";

DROP INDEX IF EXISTS "payments_stripe_subscription_id_key";

CREATE TABLE "sailing_card_subscriptions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "card_type" "sailing_card_type" NOT NULL,
  "status" "sailing_card_subscription_status" NOT NULL,
  "auto_renew" BOOLEAN NOT NULL DEFAULT true,
  "stripe_customer_id" TEXT NOT NULL,
  "stripe_subscription_id" TEXT NOT NULL,
  "stripe_product_id" TEXT,
  "stripe_subscription_item_id" TEXT,
  "current_renewal_stripe_price_id" TEXT,
  "current_renewal_price_id" TEXT,
  "current_period_start" TIMESTAMP(3),
  "current_period_end" TIMESTAMP(3),
  "trial_end" TIMESTAMP(3),
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "cancellation_reason" "membership_cancellation_reason",
  "cancellation_note" TEXT,
  "cancellation_requested_at" TIMESTAMP(3),
  "canceled_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "canonical_subscription_id" TEXT,
  "duplicate_stripe_subscription_id" TEXT,
  "last_stripe_subscription_event_id" TEXT,
  "last_stripe_subscription_event_created_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sailing_card_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sailing_card_subscriptions_paid_card_type_chk"
    CHECK ("card_type" <> 'normal'),
  CONSTRAINT "sailing_card_subscriptions_cancel_note_not_blank_chk"
    CHECK (
      "cancellation_requested_at" IS NULL
      OR "cancellation_note" IS NULL
      OR length(trim("cancellation_note")) >= 1
    )
);

CREATE UNIQUE INDEX "sailing_card_subscriptions_stripe_subscription_id_key"
  ON "sailing_card_subscriptions"("stripe_subscription_id");

CREATE INDEX "sailing_card_subscriptions_user_id_status_idx"
  ON "sailing_card_subscriptions"("user_id", "status");

CREATE INDEX "sailing_card_subscriptions_card_type_status_idx"
  ON "sailing_card_subscriptions"("card_type", "status");

CREATE INDEX "sailing_card_subscriptions_auto_renew_current_period_end_idx"
  ON "sailing_card_subscriptions"("auto_renew", "current_period_end");

CREATE INDEX "sailing_card_subscriptions_canonical_subscription_id_idx"
  ON "sailing_card_subscriptions"("canonical_subscription_id");

ALTER TABLE "sailing_card_subscriptions"
  ADD CONSTRAINT "sailing_card_subscriptions_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "user"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE,
  ADD CONSTRAINT "sailing_card_subscriptions_current_renewal_price_id_fkey"
  FOREIGN KEY ("current_renewal_price_id")
  REFERENCES "sailing_card_membership_prices"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE,
  ADD CONSTRAINT "sailing_card_subscriptions_canonical_subscription_id_fkey"
  FOREIGN KEY ("canonical_subscription_id")
  REFERENCES "sailing_card_subscriptions"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD COLUMN "membership_subscription_id" TEXT,
  ADD COLUMN "membership_payment_kind" "membership_payment_kind",
  ADD COLUMN "membership_initial_price_id" TEXT,
  ADD COLUMN "membership_renewal_price_id" TEXT,
  ADD COLUMN "membership_consent_snapshot" JSONB,
  ADD COLUMN "active_checkout_key" TEXT,
  ADD COLUMN "stripe_checkout_session_client_secret" TEXT,
  ADD COLUMN "stripe_checkout_session_url" TEXT,
  ADD COLUMN "stripe_checkout_session_expires_at" TIMESTAMP(3),
  ADD COLUMN "stripe_invoice_line_item_id" TEXT,
  ADD COLUMN "stripe_hosted_invoice_url" TEXT,
  ADD COLUMN "stripe_invoice_pdf_url" TEXT,
  ADD COLUMN "duplicate_stripe_subscription_id" TEXT,
  ADD COLUMN "stripe_refund_id" TEXT,
  ADD COLUMN "stripe_dispute_id" TEXT,
  ADD COLUMN "refunded_amount_cents" INTEGER,
  ADD COLUMN "dispute_status" TEXT,
  ADD COLUMN "issue_kind" "membership_payment_issue_kind",
  ADD COLUMN "issue_handled_note" TEXT,
  ADD COLUMN "issue_handled_by_user_id" TEXT,
  ADD COLUMN "issue_handled_at" TIMESTAMP(3),
  ADD COLUMN "last_stripe_payment_event_id" TEXT,
  ADD COLUMN "last_stripe_payment_event_created_at" TIMESTAMP(3),
  ADD COLUMN "last_stripe_invoice_event_id" TEXT,
  ADD COLUMN "last_stripe_invoice_event_created_at" TIMESTAMP(3),
  ADD CONSTRAINT "payments_membership_subscription_id_fkey"
  FOREIGN KEY ("membership_subscription_id")
  REFERENCES "sailing_card_subscriptions"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE,
  ADD CONSTRAINT "payments_membership_initial_price_id_fkey"
  FOREIGN KEY ("membership_initial_price_id")
  REFERENCES "sailing_card_membership_prices"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE,
  ADD CONSTRAINT "payments_membership_renewal_price_id_fkey"
  FOREIGN KEY ("membership_renewal_price_id")
  REFERENCES "sailing_card_membership_prices"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE,
  ADD CONSTRAINT "payments_issue_handled_by_user_id_fkey"
  FOREIGN KEY ("issue_handled_by_user_id")
  REFERENCES "user"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE,
  ADD CONSTRAINT "payments_refunded_amount_cents_chk"
  CHECK ("refunded_amount_cents" IS NULL OR "refunded_amount_cents" >= 0),
  ADD CONSTRAINT "payments_issue_handled_fields_chk"
  CHECK (
    "issue_handled_at" IS NULL
    OR (
      "issue_handled_note" IS NOT NULL
      AND length(trim("issue_handled_note")) >= 1
      AND "issue_handled_by_user_id" IS NOT NULL
    )
  );

ALTER TABLE "payments"
  DROP CONSTRAINT IF EXISTS "payments_non_stripe_no_stripe_fields_chk",
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
      AND "stripe_subscription_id" IS NULL
      AND "stripe_invoice_id" IS NULL
      AND "stripe_invoice_line_item_id" IS NULL
      AND "stripe_hosted_invoice_url" IS NULL
      AND "stripe_invoice_pdf_url" IS NULL
      AND "duplicate_stripe_subscription_id" IS NULL
      AND "stripe_refund_id" IS NULL
      AND "stripe_dispute_id" IS NULL
      AND "stripe_receipt_url" IS NULL
    )
  );

CREATE UNIQUE INDEX "payments_active_checkout_key_key"
  ON "payments"("active_checkout_key");

CREATE INDEX "payments_membership_subscription_id_created_at_idx"
  ON "payments"("membership_subscription_id", "created_at");

CREATE INDEX "payments_stripe_subscription_id_stripe_invoice_id_idx"
  ON "payments"("stripe_subscription_id", "stripe_invoice_id");

CREATE INDEX "payments_issue_kind_status_idx"
  ON "payments"("issue_kind", "status");

CREATE INDEX "payments_issue_handled_by_user_id_idx"
  ON "payments"("issue_handled_by_user_id");

CREATE OR REPLACE FUNCTION payments_prevent_classification_change()
RETURNS trigger AS $$
BEGIN
  IF NEW."purpose" IS DISTINCT FROM OLD."purpose"
    OR NEW."source" IS DISTINCT FROM OLD."source"
    OR NEW."card_type" IS DISTINCT FROM OLD."card_type"
    OR NEW."membership_payment_kind" IS DISTINCT FROM OLD."membership_payment_kind" THEN
    RAISE EXCEPTION 'payment classification fields are immutable after create';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payments_prevent_classification_change_trigger
  ON "payments";

CREATE TRIGGER payments_prevent_classification_change_trigger
  BEFORE UPDATE OF "purpose", "source", "card_type", "membership_payment_kind"
  ON "payments"
  FOR EACH ROW
  EXECUTE FUNCTION payments_prevent_classification_change();
