CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "user_id" TEXT,
    "newsletter_subscriber_id" TEXT,
    "newsletter_broadcast_id" TEXT,
    "newsletter_delivery_id" TEXT,
    "to_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "last_event_type" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "bounced_at" TIMESTAMP(3),
    "complained_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "suppressed_at" TIMESTAMP(3),
    "last_event_at" TIMESTAMP(3),
    "last_error" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_message_events" (
    "id" TEXT NOT NULL,
    "email_message_id" TEXT,
    "provider" TEXT NOT NULL,
    "provider_event_id" TEXT,
    "provider_event_type" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_message_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_messages_provider_provider_message_id_key" ON "email_messages"("provider", "provider_message_id");
CREATE UNIQUE INDEX "email_messages_newsletter_delivery_id_key" ON "email_messages"("newsletter_delivery_id");
CREATE INDEX "email_messages_user_id_created_at_idx" ON "email_messages"("user_id", "created_at");
CREATE INDEX "email_messages_to_email_created_at_idx" ON "email_messages"("to_email", "created_at");
CREATE INDEX "email_messages_category_created_at_idx" ON "email_messages"("category", "created_at");
CREATE INDEX "email_messages_last_event_type_created_at_idx" ON "email_messages"("last_event_type", "created_at");
CREATE INDEX "email_messages_newsletter_broadcast_id_idx" ON "email_messages"("newsletter_broadcast_id");
CREATE INDEX "email_messages_newsletter_subscriber_id_created_at_idx" ON "email_messages"("newsletter_subscriber_id", "created_at");

CREATE UNIQUE INDEX "email_message_events_provider_provider_event_id_key" ON "email_message_events"("provider", "provider_event_id");
CREATE INDEX "email_message_events_email_message_id_occurred_at_idx" ON "email_message_events"("email_message_id", "occurred_at");
CREATE INDEX "email_message_events_provider_message_id_occurred_at_idx" ON "email_message_events"("provider_message_id", "occurred_at");
CREATE INDEX "email_message_events_provider_event_type_occurred_at_idx" ON "email_message_events"("provider_event_type", "occurred_at");

ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_newsletter_subscriber_id_fkey" FOREIGN KEY ("newsletter_subscriber_id") REFERENCES "newsletter_subscribers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_newsletter_broadcast_id_fkey" FOREIGN KEY ("newsletter_broadcast_id") REFERENCES "newsletter_broadcasts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_newsletter_delivery_id_fkey" FOREIGN KEY ("newsletter_delivery_id") REFERENCES "newsletter_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_message_events" ADD CONSTRAINT "email_message_events_email_message_id_fkey" FOREIGN KEY ("email_message_id") REFERENCES "email_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
