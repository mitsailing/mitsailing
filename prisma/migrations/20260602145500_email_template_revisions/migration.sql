-- CreateEnum
CREATE TYPE "email_template_family" AS ENUM ('newsletter', 'pavilion_reservation', 'event_payment', 'membership_payment');

-- CreateEnum
CREATE TYPE "email_template_revision_status" AS ENUM ('draft', 'published', 'archived');

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "family" "email_template_family" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_template_revisions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "status" "email_template_revision_status" NOT NULL DEFAULT 'draft',
    "subject" TEXT NOT NULL,
    "preview_text" TEXT NOT NULL,
    "editor_json" JSONB,
    "editor_body_html" TEXT NOT NULL,
    "rendered_text" TEXT NOT NULL,
    "render_hash" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "published_by_user_id" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_template_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_key_key" ON "email_templates"("key");

-- CreateIndex
CREATE INDEX "email_templates_family_name_idx" ON "email_templates"("family", "name");

-- CreateIndex
CREATE INDEX "email_template_revisions_template_id_status_published_at_idx" ON "email_template_revisions"("template_id", "status", "published_at");

-- CreateIndex
CREATE INDEX "email_template_revisions_created_by_user_id_idx" ON "email_template_revisions"("created_by_user_id");

-- CreateIndex
CREATE INDEX "email_template_revisions_published_by_user_id_idx" ON "email_template_revisions"("published_by_user_id");

-- AddForeignKey
ALTER TABLE "email_template_revisions" ADD CONSTRAINT "email_template_revisions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "email_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_template_revisions" ADD CONSTRAINT "email_template_revisions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_template_revisions" ADD CONSTRAINT "email_template_revisions_published_by_user_id_fkey" FOREIGN KEY ("published_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
