-- CreateEnum
CREATE TYPE "EventDetailPageKind" AS ENUM ('standard', 'external');

-- CreateEnum
CREATE TYPE "EventRegistrationStatus" AS ENUM ('pending', 'approved', 'cancelled');

-- CreateEnum
CREATE TYPE "EventAnswerType" AS ENUM ('text', 'select', 'checkbox');

-- CreateTable
CREATE TABLE "event_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "is_visible" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "event_category_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_special" BOOLEAN NOT NULL,
    "max_participants" INTEGER,
    "requires_approval" BOOLEAN NOT NULL,
    "registration_start" TIMESTAMP(3),
    "registration_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "detail_page_kind" "EventDetailPageKind",
    "external_detail_url" TEXT,
    "internal_notes" TEXT,
    "is_published" BOOLEAN NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_dates" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "start_datetime" TIMESTAMP(3) NOT NULL,
    "end_datetime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_admins" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,

    CONSTRAINT "event_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "EventRegistrationStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "swim_agreement_accepted_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registration_questions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "answer_type" "EventAnswerType" NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL,
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "event_registration_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registration_answers" (
    "id" TEXT NOT NULL,
    "registration_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "event_registration_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_entry_fees" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "is_deposit" BOOLEAN NOT NULL,

    CONSTRAINT "event_entry_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_comments" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sailing_classes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "prerequisite_ids" TEXT[],
    "related_event_ids" TEXT[],
    "unlocked_boat_ids" TEXT[],

    CONSTRAINT "sailing_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fleet_boats" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "required_class_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image_paths" TEXT[],

    CONSTRAINT "fleet_boats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_members" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "bio" TEXT,
    "fullBio" JSONB NOT NULL,
    "image_src" TEXT,
    "image_alt" TEXT,
    "email" TEXT NOT NULL,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_event_category_id_idx" ON "events"("event_category_id");

-- CreateIndex
CREATE INDEX "event_dates_event_id_idx" ON "event_dates"("event_id");

-- CreateIndex
CREATE INDEX "event_admins_event_id_idx" ON "event_admins"("event_id");

-- CreateIndex
CREATE INDEX "event_admins_admin_user_id_idx" ON "event_admins"("admin_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_admins_event_id_admin_user_id_key" ON "event_admins"("event_id", "admin_user_id");

-- CreateIndex
CREATE INDEX "event_registrations_event_id_idx" ON "event_registrations"("event_id");

-- CreateIndex
CREATE INDEX "event_registrations_user_id_idx" ON "event_registrations"("user_id");

-- CreateIndex
CREATE INDEX "event_registration_questions_event_id_idx" ON "event_registration_questions"("event_id");

-- CreateIndex
CREATE INDEX "event_registration_answers_registration_id_idx" ON "event_registration_answers"("registration_id");

-- CreateIndex
CREATE INDEX "event_registration_answers_question_id_idx" ON "event_registration_answers"("question_id");

-- CreateIndex
CREATE INDEX "event_entry_fees_event_id_idx" ON "event_entry_fees"("event_id");

-- CreateIndex
CREATE INDEX "event_comments_event_id_idx" ON "event_comments"("event_id");

-- CreateIndex
CREATE INDEX "event_comments_user_id_idx" ON "event_comments"("user_id");

-- CreateIndex
CREATE INDEX "event_comments_parent_id_idx" ON "event_comments"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "sailing_classes_slug_key" ON "sailing_classes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "fleet_boats_slug_key" ON "fleet_boats"("slug");

-- CreateIndex
CREATE INDEX "fleet_boats_required_class_id_idx" ON "fleet_boats"("required_class_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_slug_key" ON "staff_members"("slug");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_event_category_id_fkey" FOREIGN KEY ("event_category_id") REFERENCES "event_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_dates" ADD CONSTRAINT "event_dates_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_admins" ADD CONSTRAINT "event_admins_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_admins" ADD CONSTRAINT "event_admins_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registration_questions" ADD CONSTRAINT "event_registration_questions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registration_answers" ADD CONSTRAINT "event_registration_answers_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "event_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registration_answers" ADD CONSTRAINT "event_registration_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "event_registration_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_entry_fees" ADD CONSTRAINT "event_entry_fees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "event_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_boats" ADD CONSTRAINT "fleet_boats_required_class_id_fkey" FOREIGN KEY ("required_class_id") REFERENCES "sailing_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
