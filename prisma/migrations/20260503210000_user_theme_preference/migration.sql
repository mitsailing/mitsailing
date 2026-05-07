-- Per-user appearance: auto (system) / light / dark for next-themes.

CREATE TYPE "theme_preference" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

ALTER TABLE "user" ADD COLUMN "theme_preference" "theme_preference" NOT NULL DEFAULT 'SYSTEM';
