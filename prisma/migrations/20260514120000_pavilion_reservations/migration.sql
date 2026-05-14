CREATE TYPE "pavilion_reservation_persona" AS ENUM (
  'mit_academic',
  'mit_student',
  'mit_community',
  'non_mit'
);

CREATE TYPE "pavilion_reservation_status" AS ENUM (
  'pending',
  'approved',
  'declined',
  'cancelled'
);

CREATE TYPE "pavilion_reservable_item_kind" AS ENUM ('space', 'service');

CREATE TYPE "pavilion_pricing_type" AS ENUM ('hourly', 'flat', 'tbd');

CREATE TABLE "pavilion_reservable_items" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "kind" "pavilion_reservable_item_kind" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "image_url" TEXT,
  "pricing_type" "pavilion_pricing_type" NOT NULL,
  "min_duration_hours" INTEGER,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "is_visible" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pavilion_reservable_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pavilion_reservable_items_min_duration_hours_check" CHECK ("min_duration_hours" IS NULL OR "min_duration_hours" > 0)
);

CREATE TABLE "pavilion_reservable_item_prices" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "persona" "pavilion_reservation_persona" NOT NULL,
  "amount_cents" INTEGER,

  CONSTRAINT "pavilion_reservable_item_prices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pavilion_reservable_item_prices_amount_cents_check" CHECK ("amount_cents" IS NULL OR "amount_cents" >= 0)
);

CREATE TABLE "pavilion_reservation_requests" (
  "id" TEXT NOT NULL,
  "reference_code" TEXT NOT NULL,
  "status" "pavilion_reservation_status" NOT NULL DEFAULT 'pending',
  "persona" "pavilion_reservation_persona" NOT NULL,
  "requester_email" TEXT NOT NULL,
  "first_name" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "event_name" TEXT NOT NULL,
  "group_name" TEXT,
  "group_size" INTEGER,
  "description" TEXT NOT NULL,
  "has_tent" BOOLEAN NOT NULL,
  "serves_alcohol" BOOLEAN NOT NULL,
  "project_title" TEXT,
  "advisor_name" TEXT,
  "advisor_email" TEXT,
  "cost_center" TEXT,
  "mit_id" TEXT,
  "mit_account" TEXT,
  "estimated_total_cents" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_by_user_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "admin_notes" TEXT,

  CONSTRAINT "pavilion_reservation_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pavilion_reservation_requests_group_size_check" CHECK ("group_size" IS NULL OR "group_size" > 0),
  CONSTRAINT "pavilion_reservation_requests_estimated_total_cents_check" CHECK ("estimated_total_cents" IS NULL OR "estimated_total_cents" >= 0)
);

CREATE TABLE "pavilion_reservation_slots" (
  "id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "requested_date" DATE NOT NULL,
  "start_minutes" INTEGER NOT NULL,
  "end_minutes" INTEGER NOT NULL,
  "estimated_amount_cents" INTEGER,
  "display_order" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "pavilion_reservation_slots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pavilion_reservation_slots_minutes_check" CHECK ("start_minutes" >= 0 AND "start_minutes" < 1440 AND "end_minutes" > 0 AND "end_minutes" <= 1560 AND "end_minutes" > "start_minutes"),
  CONSTRAINT "pavilion_reservation_slots_estimated_amount_cents_check" CHECK ("estimated_amount_cents" IS NULL OR "estimated_amount_cents" >= 0)
);

CREATE TABLE "pavilion_reservation_services" (
  "id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "estimated_amount_cents" INTEGER,

  CONSTRAINT "pavilion_reservation_services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pavilion_reservation_services_estimated_amount_cents_check" CHECK ("estimated_amount_cents" IS NULL OR "estimated_amount_cents" >= 0)
);

CREATE FUNCTION update_pavilion_reservable_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION update_pavilion_reservation_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pavilion_reservable_items_updated_at_trigger
BEFORE UPDATE ON "pavilion_reservable_items"
FOR EACH ROW
EXECUTE FUNCTION update_pavilion_reservable_items_updated_at();

CREATE TRIGGER pavilion_reservation_requests_updated_at_trigger
BEFORE UPDATE ON "pavilion_reservation_requests"
FOR EACH ROW
EXECUTE FUNCTION update_pavilion_reservation_requests_updated_at();

CREATE UNIQUE INDEX "pavilion_reservable_items_slug_key" ON "pavilion_reservable_items"("slug");
CREATE INDEX "pavilion_reservable_items_kind_is_visible_display_order_idx" ON "pavilion_reservable_items"("kind", "is_visible", "display_order");
CREATE UNIQUE INDEX "pavilion_reservable_item_prices_item_id_persona_key" ON "pavilion_reservable_item_prices"("item_id", "persona");
CREATE UNIQUE INDEX "pavilion_reservation_requests_reference_code_key" ON "pavilion_reservation_requests"("reference_code");
CREATE INDEX "pavilion_reservation_requests_status_created_at_idx" ON "pavilion_reservation_requests"("status", "created_at");
CREATE INDEX "pavilion_reservation_requests_requester_email_idx" ON "pavilion_reservation_requests"("requester_email");
CREATE INDEX "pavilion_reservation_requests_reviewed_by_user_id_idx" ON "pavilion_reservation_requests"("reviewed_by_user_id");
CREATE INDEX "pavilion_reservation_slots_request_id_display_order_idx" ON "pavilion_reservation_slots"("request_id", "display_order");
CREATE INDEX "pavilion_reservation_slots_item_id_requested_date_idx" ON "pavilion_reservation_slots"("item_id", "requested_date");
CREATE UNIQUE INDEX "pavilion_reservation_services_request_id_item_id_key" ON "pavilion_reservation_services"("request_id", "item_id");
CREATE INDEX "pavilion_reservation_services_item_id_idx" ON "pavilion_reservation_services"("item_id");

ALTER TABLE "pavilion_reservable_item_prices"
  ADD CONSTRAINT "pavilion_reservable_item_prices_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "pavilion_reservable_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pavilion_reservation_requests"
  ADD CONSTRAINT "pavilion_reservation_requests_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pavilion_reservation_slots"
  ADD CONSTRAINT "pavilion_reservation_slots_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "pavilion_reservation_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pavilion_reservation_slots"
  ADD CONSTRAINT "pavilion_reservation_slots_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "pavilion_reservable_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pavilion_reservation_services"
  ADD CONSTRAINT "pavilion_reservation_services_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "pavilion_reservation_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pavilion_reservation_services"
  ADD CONSTRAINT "pavilion_reservation_services_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "pavilion_reservable_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
