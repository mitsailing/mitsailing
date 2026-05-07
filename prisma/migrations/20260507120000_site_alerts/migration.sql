-- Site alerts (marketing banner + /alerts index)

CREATE TABLE "site_alerts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "banner_visible_from" TIMESTAMP(3) NOT NULL,
    "banner_visible_until" TIMESTAMP(3),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "site_alerts_created_by_idx" ON "site_alerts"("created_by");

CREATE INDEX "site_alerts_updated_by_idx" ON "site_alerts"("updated_by");

CREATE INDEX "site_alerts_is_published_display_order_banner_visible_from_idx" ON "site_alerts"("is_published", "display_order", "banner_visible_from");

ALTER TABLE "site_alerts" ADD CONSTRAINT "site_alerts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "site_alerts" ADD CONSTRAINT "site_alerts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
