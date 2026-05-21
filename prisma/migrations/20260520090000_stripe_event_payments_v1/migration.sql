CREATE TYPE "event_address_preset" AS ENUM ('pavilion', 'bluewater', 'custom');
CREATE TYPE "event_payment_status" AS ENUM (
    'pending',
    'checkout_created',
    'paid',
    'past_due',
    'handled',
    'cancelled',
    'refunded',
    'disputed'
);
CREATE TYPE "event_payment_notification_kind" AS ENUM (
    'request',
    'receipt',
    'reminder',
    'admin_digest'
);

ALTER TABLE "events"
ADD COLUMN "payments_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "payment_deadline_at" TIMESTAMP(3),
ADD COLUMN "address_preset" "event_address_preset" NOT NULL DEFAULT 'pavilion',
ADD COLUMN "address_name" TEXT,
ADD COLUMN "address_line1" TEXT,
ADD COLUMN "address_line2" TEXT,
ADD COLUMN "address_city" TEXT,
ADD COLUMN "address_state" TEXT,
ADD COLUMN "address_postal_code" TEXT,
ADD COLUMN "address_country" TEXT;

UPDATE "events"
SET
    "address_preset" = 'pavilion',
    "address_name" = 'MIT Sailing Pavilion',
    "address_line1" = '134 Memorial Drive',
    "address_city" = 'Cambridge',
    "address_state" = 'MA',
    "address_postal_code" = '02139',
    "address_country" = 'US',
    "payments_enabled" = false
WHERE "address_name" IS NULL;

CREATE TABLE "event_payments" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "registration_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "selected_fee_id" TEXT NOT NULL,
    "selected_fee_description" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "event_payment_status" NOT NULL DEFAULT 'pending',
    "stripe_customer_id" TEXT,
    "stripe_checkout_session_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "stripe_charge_id" TEXT,
    "stripe_receipt_url" TEXT,
    "manual_handled_note" TEXT,
    "manual_handled_by_user_id" TEXT,
    "manual_handled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "event_payments_amount_cents_check" CHECK ("amount_cents" > 0),
    CONSTRAINT "event_payments_currency_check" CHECK ("currency" = 'usd')
);

CREATE TABLE "stripe_webhook_events" (
    "id" TEXT NOT NULL,
    "stripe_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "stripe_created_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "processing_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_payment_notifications" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "kind" "event_payment_notification_kind" NOT NULL,
    "sent_date_key" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_payment_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_payments_registration_id_key" ON "event_payments"("registration_id");
CREATE INDEX "event_payments_stripe_customer_id_idx" ON "event_payments"("stripe_customer_id");
CREATE UNIQUE INDEX "event_payments_stripe_checkout_session_id_key" ON "event_payments"("stripe_checkout_session_id");
CREATE UNIQUE INDEX "event_payments_stripe_payment_intent_id_key" ON "event_payments"("stripe_payment_intent_id");
CREATE UNIQUE INDEX "event_payments_stripe_charge_id_key" ON "event_payments"("stripe_charge_id");
CREATE INDEX "event_payments_event_id_status_idx" ON "event_payments"("event_id", "status");
CREATE INDEX "event_payments_user_id_created_at_idx" ON "event_payments"("user_id", "created_at");
CREATE INDEX "event_payments_selected_fee_id_idx" ON "event_payments"("selected_fee_id");
CREATE INDEX "event_payments_manual_handled_by_user_id_idx" ON "event_payments"("manual_handled_by_user_id");
CREATE UNIQUE INDEX "event_payments_registration_id_event_id_user_id_key" ON "event_payments"("registration_id", "event_id", "user_id");
CREATE UNIQUE INDEX "event_registrations_id_event_id_user_id_key" ON "event_registrations"("id", "event_id", "user_id");

CREATE UNIQUE INDEX "stripe_webhook_events_stripe_event_id_key" ON "stripe_webhook_events"("stripe_event_id");
CREATE INDEX "stripe_webhook_events_event_type_stripe_created_at_idx" ON "stripe_webhook_events"("event_type", "stripe_created_at");
CREATE INDEX "stripe_webhook_events_processed_at_idx" ON "stripe_webhook_events"("processed_at");

CREATE INDEX "event_payment_notifications_payment_id_created_at_idx" ON "event_payment_notifications"("payment_id", "created_at");
CREATE INDEX "event_payment_notifications_kind_sent_date_key_idx" ON "event_payment_notifications"("kind", "sent_date_key");
CREATE UNIQUE INDEX "event_payment_notifications_payment_id_kind_sent_date_key_key" ON "event_payment_notifications"("payment_id", "kind", "sent_date_key");

ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_registration_id_event_id_user_id_fkey" FOREIGN KEY ("registration_id", "event_id", "user_id") REFERENCES "event_registrations"("id", "event_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_event_id_selected_fee_id_fkey" FOREIGN KEY ("event_id", "selected_fee_id") REFERENCES "event_entry_fees"("event_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_manual_handled_by_user_id_fkey" FOREIGN KEY ("manual_handled_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_payment_notifications" ADD CONSTRAINT "event_payment_notifications_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "event_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
