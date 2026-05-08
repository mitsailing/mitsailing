-- CreateEnum
CREATE TYPE "sailing_rating_rule_target_type" AS ENUM ('rating', 'class', 'boat');

-- CreateEnum
CREATE TYPE "sailing_rating_rule_type" AS ENUM ('requires', 'grants');

-- CreateTable
CREATE TABLE "sailing_ratings" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "level" TEXT,
    "guide_url" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "is_deprecated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sailing_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sailing_ratings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sailing_rating_id" TEXT NOT NULL,
    "issued_by_user_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sailing_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sailing_rating_rules" (
    "id" TEXT NOT NULL,
    "target_type" "sailing_rating_rule_target_type" NOT NULL,
    "target_id" TEXT NOT NULL,
    "rule_type" "sailing_rating_rule_type" NOT NULL,
    "sailing_rating_id" TEXT NOT NULL,
    "group_key" TEXT NOT NULL DEFAULT 'default',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sailing_rating_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sailing_ratings_slug_key" ON "sailing_ratings"("slug");

-- CreateIndex
CREATE INDEX "sailing_ratings_is_visible_display_order_idx" ON "sailing_ratings"("is_visible", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "user_sailing_ratings_user_id_sailing_rating_id_key" ON "user_sailing_ratings"("user_id", "sailing_rating_id");

-- CreateIndex
CREATE INDEX "user_sailing_ratings_user_id_idx" ON "user_sailing_ratings"("user_id");

-- CreateIndex
CREATE INDEX "user_sailing_ratings_sailing_rating_id_idx" ON "user_sailing_ratings"("sailing_rating_id");

-- CreateIndex
CREATE INDEX "user_sailing_ratings_issued_by_user_id_idx" ON "user_sailing_ratings"("issued_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sailing_rating_rules_target_type_target_id_rule_type_group_key_sailing_rating_id_key" ON "sailing_rating_rules"("target_type", "target_id", "rule_type", "group_key", "sailing_rating_id");

-- CreateIndex
CREATE INDEX "sailing_rating_rules_target_type_target_id_rule_type_idx" ON "sailing_rating_rules"("target_type", "target_id", "rule_type");

-- CreateIndex
CREATE INDEX "sailing_rating_rules_sailing_rating_id_idx" ON "sailing_rating_rules"("sailing_rating_id");

-- AddForeignKey
ALTER TABLE "user_sailing_ratings" ADD CONSTRAINT "user_sailing_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sailing_ratings" ADD CONSTRAINT "user_sailing_ratings_sailing_rating_id_fkey" FOREIGN KEY ("sailing_rating_id") REFERENCES "sailing_ratings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sailing_ratings" ADD CONSTRAINT "user_sailing_ratings_issued_by_user_id_fkey" FOREIGN KEY ("issued_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sailing_rating_rules" ADD CONSTRAINT "sailing_rating_rules_sailing_rating_id_fkey" FOREIGN KEY ("sailing_rating_id") REFERENCES "sailing_ratings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
