DO $$
BEGIN
  CREATE TYPE "AppRole" AS ENUM (
    'user',
    'volunteer',
    'volunteer_instructor',
    'dock_staff',
    'dock_master',
    'admin'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "app_role" "AppRole" NOT NULL DEFAULT 'user';

UPDATE "user"
SET "app_role" = CASE
  WHEN "role" IN (
    'user',
    'volunteer',
    'volunteer_instructor',
    'dock_staff',
    'dock_master',
    'admin'
  ) THEN "role"::"AppRole"
  ELSE 'user'::"AppRole"
END;
