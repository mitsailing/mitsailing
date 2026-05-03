-- CreateTable
CREATE TABLE "donation_funds" (
    "id" TEXT NOT NULL,
    "designation_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "give_url" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donation_funds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "donation_funds_designation_id_key" ON "donation_funds"("designation_id");

-- CreateIndex
CREATE INDEX "donation_funds_is_visible_display_order_idx" ON "donation_funds"("is_visible", "display_order");
