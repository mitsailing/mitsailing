-- CreateEnum
CREATE TYPE "newsletter_list_default_subscription" AS ENUM ('opt_in', 'opt_out');

-- CreateEnum
CREATE TYPE "newsletter_list_visibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "newsletter_subscriber_suppression_reason" AS ENUM ('bounced', 'complained', 'suppressed', 'admin');

-- CreateEnum
CREATE TYPE "newsletter_subscription_status" AS ENUM ('subscribed', 'unsubscribed');

-- CreateEnum
CREATE TYPE "newsletter_broadcast_status" AS ENUM ('draft', 'queued', 'sending', 'sent', 'paused', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "newsletter_delivery_status" AS ENUM ('queued', 'sending', 'sent', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'failed', 'suppressed', 'cancelled');

-- CreateEnum
CREATE TYPE "newsletter_event_type" AS ENUM ('subscribed', 'unsubscribed', 'unsubscribed_all', 'resubscribed', 'bounced', 'complained', 'suppressed', 'delivered', 'delivery_delayed', 'failed', 'sent', 'broadcast_created', 'broadcast_queued');

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "user_id" TEXT,
    "resend_contact_id" TEXT,
    "manage_token_hash" TEXT NOT NULL,
    "global_unsubscribed_at" TIMESTAMP(3),
    "suppressed_at" TIMESTAMP(3),
    "suppression_reason" "newsletter_subscriber_suppression_reason",
    "source" TEXT,
    "consented_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consent_ip_address" TEXT,
    "consent_user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_lists" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "default_subscription" "newsletter_list_default_subscription" NOT NULL DEFAULT 'opt_out',
    "visibility" "newsletter_list_visibility" NOT NULL DEFAULT 'public',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "resend_topic_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscriptions" (
    "id" TEXT NOT NULL,
    "subscriber_id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "status" "newsletter_subscription_status" NOT NULL DEFAULT 'subscribed',
    "source" TEXT,
    "subscribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_templates" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_broadcasts" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "subject" TEXT NOT NULL,
    "preview_text" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "newsletter_broadcast_status" NOT NULL DEFAULT 'draft',
    "template_id" TEXT NOT NULL,
    "primary_list_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "resend_broadcast_id" TEXT,
    "queued_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_broadcast_lists" (
    "broadcast_id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,

    CONSTRAINT "newsletter_broadcast_lists_pkey" PRIMARY KEY ("broadcast_id","list_id")
);

-- CreateTable
CREATE TABLE "newsletter_deliveries" (
    "id" TEXT NOT NULL,
    "broadcast_id" TEXT NOT NULL,
    "subscriber_id" TEXT NOT NULL,
    "primary_list_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "newsletter_delivery_status" NOT NULL DEFAULT 'queued',
    "provider_message_id" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_events" (
    "id" TEXT NOT NULL,
    "type" "newsletter_event_type" NOT NULL,
    "subscriber_id" TEXT,
    "list_id" TEXT,
    "broadcast_id" TEXT,
    "delivery_id" TEXT,
    "actor_user_id" TEXT,
    "email" TEXT,
    "provider_message_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");
CREATE UNIQUE INDEX "newsletter_subscribers_user_id_key" ON "newsletter_subscribers"("user_id");
CREATE UNIQUE INDEX "newsletter_subscribers_resend_contact_id_key" ON "newsletter_subscribers"("resend_contact_id");
CREATE UNIQUE INDEX "newsletter_subscribers_manage_token_hash_key" ON "newsletter_subscribers"("manage_token_hash");
CREATE INDEX "newsletter_subscribers_suppressed_at_idx" ON "newsletter_subscribers"("suppressed_at");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_lists_slug_key" ON "newsletter_lists"("slug");
CREATE UNIQUE INDEX "newsletter_lists_resend_topic_id_key" ON "newsletter_lists"("resend_topic_id");
CREATE INDEX "newsletter_lists_visibility_display_order_idx" ON "newsletter_lists"("visibility", "display_order");
CREATE INDEX "newsletter_lists_is_archived_display_order_idx" ON "newsletter_lists"("is_archived", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscriptions_subscriber_id_list_id_key" ON "newsletter_subscriptions"("subscriber_id", "list_id");
CREATE INDEX "newsletter_subscriptions_list_id_status_idx" ON "newsletter_subscriptions"("list_id", "status");
CREATE INDEX "newsletter_subscriptions_status_updated_at_idx" ON "newsletter_subscriptions"("status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_templates_slug_key" ON "newsletter_templates"("slug");
CREATE INDEX "newsletter_templates_is_default_idx" ON "newsletter_templates"("is_default");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_broadcasts_resend_broadcast_id_key" ON "newsletter_broadcasts"("resend_broadcast_id");
CREATE INDEX "newsletter_broadcasts_status_created_at_idx" ON "newsletter_broadcasts"("status", "created_at");
CREATE INDEX "newsletter_broadcasts_created_by_user_id_idx" ON "newsletter_broadcasts"("created_by_user_id");
CREATE INDEX "newsletter_broadcasts_primary_list_id_idx" ON "newsletter_broadcasts"("primary_list_id");
CREATE INDEX "newsletter_broadcasts_template_id_idx" ON "newsletter_broadcasts"("template_id");

-- CreateIndex
CREATE INDEX "newsletter_broadcast_lists_list_id_idx" ON "newsletter_broadcast_lists"("list_id");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_deliveries_provider_message_id_key" ON "newsletter_deliveries"("provider_message_id");
CREATE UNIQUE INDEX "newsletter_deliveries_broadcast_id_subscriber_id_key" ON "newsletter_deliveries"("broadcast_id", "subscriber_id");
CREATE INDEX "newsletter_deliveries_status_queued_at_idx" ON "newsletter_deliveries"("status", "queued_at");
CREATE INDEX "newsletter_deliveries_subscriber_id_idx" ON "newsletter_deliveries"("subscriber_id");
CREATE INDEX "newsletter_deliveries_primary_list_id_idx" ON "newsletter_deliveries"("primary_list_id");

-- CreateIndex
CREATE INDEX "newsletter_events_type_created_at_idx" ON "newsletter_events"("type", "created_at");
CREATE INDEX "newsletter_events_subscriber_id_created_at_idx" ON "newsletter_events"("subscriber_id", "created_at");
CREATE INDEX "newsletter_events_list_id_created_at_idx" ON "newsletter_events"("list_id", "created_at");
CREATE INDEX "newsletter_events_broadcast_id_created_at_idx" ON "newsletter_events"("broadcast_id", "created_at");
CREATE INDEX "newsletter_events_delivery_id_idx" ON "newsletter_events"("delivery_id");
CREATE INDEX "newsletter_events_provider_message_id_idx" ON "newsletter_events"("provider_message_id");

-- AddForeignKey
ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_subscriptions" ADD CONSTRAINT "newsletter_subscriptions_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "newsletter_subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "newsletter_subscriptions" ADD CONSTRAINT "newsletter_subscriptions_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "newsletter_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_broadcasts" ADD CONSTRAINT "newsletter_broadcasts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "newsletter_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "newsletter_broadcasts" ADD CONSTRAINT "newsletter_broadcasts_primary_list_id_fkey" FOREIGN KEY ("primary_list_id") REFERENCES "newsletter_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "newsletter_broadcasts" ADD CONSTRAINT "newsletter_broadcasts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_broadcast_lists" ADD CONSTRAINT "newsletter_broadcast_lists_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "newsletter_broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "newsletter_broadcast_lists" ADD CONSTRAINT "newsletter_broadcast_lists_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "newsletter_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_deliveries" ADD CONSTRAINT "newsletter_deliveries_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "newsletter_broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "newsletter_deliveries" ADD CONSTRAINT "newsletter_deliveries_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "newsletter_subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "newsletter_deliveries" ADD CONSTRAINT "newsletter_deliveries_primary_list_id_fkey" FOREIGN KEY ("primary_list_id") REFERENCES "newsletter_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_events" ADD CONSTRAINT "newsletter_events_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "newsletter_subscribers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "newsletter_events" ADD CONSTRAINT "newsletter_events_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "newsletter_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "newsletter_events" ADD CONSTRAINT "newsletter_events_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "newsletter_broadcasts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "newsletter_events" ADD CONSTRAINT "newsletter_events_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "newsletter_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "newsletter_events" ADD CONSTRAINT "newsletter_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SeedData
INSERT INTO "newsletter_lists" ("id", "slug", "name", "description", "default_subscription", "visibility", "display_order", "created_at", "updated_at")
VALUES
  ('general', 'general', 'General', 'News and updates from MIT Sailing.', 'opt_in', 'public', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('racing', 'racing', 'Racing', 'Regatta, team, and racing program updates.', 'opt_out', 'public', 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('bluewater', 'bluewater', 'Bluewater', 'Bluewater sailing opportunities and notices.', 'opt_out', 'public', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('windsurfing', 'windsurfing', 'Windsurfing', 'Windsurfing classes, conditions, and events.', 'opt_out', 'public', 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "newsletter_templates" ("id", "slug", "name", "description", "is_default", "created_at", "updated_at")
VALUES ('standard', 'standard', 'Standard newsletter', 'Default MIT Sailing newsletter layout.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
