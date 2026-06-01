CREATE TYPE "sailing_card_membership_price_kind" AS ENUM ('spring', 'full');

CREATE TYPE "sailing_card_membership_price_category" AS ENUM (
  'student',
  'under_30',
  'thirty_or_over'
);

CREATE TYPE "sailing_card_membership_billing_interval" AS ENUM (
  'one_time',
  'annual'
);

CREATE TABLE "sailing_card_membership_prices" (
  "id" TEXT NOT NULL,
  "card_type" "sailing_card_type" NOT NULL,
  "price_kind" "sailing_card_membership_price_kind" NOT NULL,
  "price_category" "sailing_card_membership_price_category" NOT NULL,
  "billing_interval" "sailing_card_membership_billing_interval" NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "effective_at" TIMESTAMP(3) NOT NULL,
  "change_reason" TEXT NOT NULL,
  "stripe_price_id" TEXT,
  "stripe_sync_error" TEXT,
  "stripe_synced_at" TIMESTAMP(3),
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sailing_card_membership_prices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sailing_card_membership_prices_paid_card_type_chk"
    CHECK ("card_type" <> 'normal'),
  CONSTRAINT "sailing_card_membership_prices_amount_cents_min_chk"
    CHECK ("amount_cents" >= 50),
  CONSTRAINT "sailing_card_membership_prices_currency_usd_chk"
    CHECK ("currency" = 'usd'),
  CONSTRAINT "sailing_card_membership_prices_price_kind_interval_chk"
    CHECK (
      ("price_kind" = 'spring' AND "billing_interval" = 'one_time')
      OR "price_kind" = 'full'
    ),
  CONSTRAINT "sailing_card_membership_prices_change_reason_not_blank_chk"
    CHECK (length(trim("change_reason")) >= 1)
);

CREATE UNIQUE INDEX "sailing_card_membership_prices_stripe_price_id_key"
ON "sailing_card_membership_prices"("stripe_price_id");

CREATE INDEX "sailing_card_membership_prices_created_by_user_id_idx"
ON "sailing_card_membership_prices"("created_by_user_id");

CREATE UNIQUE INDEX "sailing_card_membership_prices_card_type_price_kind_price_c_key"
ON "sailing_card_membership_prices"(
  "card_type",
  "price_kind",
  "price_category",
  "billing_interval",
  "effective_at"
);

ALTER TABLE "sailing_card_membership_prices"
ADD CONSTRAINT "sailing_card_membership_prices_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id")
REFERENCES "user"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE FUNCTION sailing_card_membership_prices_prevent_catalog_key_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.card_type IS DISTINCT FROM OLD.card_type
    OR NEW.price_kind IS DISTINCT FROM OLD.price_kind
    OR NEW.price_category IS DISTINCT FROM OLD.price_category
    OR NEW.billing_interval IS DISTINCT FROM OLD.billing_interval
    OR NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.effective_at IS DISTINCT FROM OLD.effective_at
    OR NEW.change_reason IS DISTINCT FROM OLD.change_reason
    OR (
      NEW.created_by_user_id IS NOT NULL
      AND NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
    )
    OR (
      OLD.stripe_price_id IS NOT NULL
      AND NEW.stripe_price_id IS DISTINCT FROM OLD.stripe_price_id
    )
  THEN
    RAISE EXCEPTION
      'sailing_card_membership_prices catalog key, amount, and synced Stripe Price fields are immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sailing_card_membership_prices_prevent_catalog_key_change_trigger
  BEFORE UPDATE ON "sailing_card_membership_prices"
  FOR EACH ROW
  EXECUTE FUNCTION sailing_card_membership_prices_prevent_catalog_key_change();
