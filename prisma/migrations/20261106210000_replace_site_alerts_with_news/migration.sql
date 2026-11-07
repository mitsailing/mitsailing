-- Start news empty. Existing site alert rows are not kept.
DROP TABLE IF EXISTS "site_alerts";
DROP TABLE IF EXISTS "news";

CREATE TABLE "news" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "start_date" DATE NOT NULL,
    "last_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "news_is_published_start_date_idx" ON "news"("is_published", "start_date");
