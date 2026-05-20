ALTER TABLE "events"
  ADD COLUMN "faq_visible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "faq_content" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "notice_of_race_visible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notice_of_race_content" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "sailing_instructions_visible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sailing_instructions_content" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "results_visible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "results_content" TEXT NOT NULL DEFAULT '';
