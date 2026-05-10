ALTER TABLE "fleet_boats" RENAME COLUMN "image_paths" TO "image_path";

ALTER TABLE "fleet_boats"
  ALTER COLUMN "image_path" TYPE TEXT USING "image_path"[1];

UPDATE "user_audit"
SET "audited_changes" =
  ("audited_changes" - 'imagePaths') ||
  jsonb_build_object(
    'imagePath',
    CASE
      WHEN jsonb_typeof("audited_changes"->'imagePaths') = 'array'
      THEN "audited_changes"->'imagePaths'->>0
      ELSE NULL
    END
  )
WHERE "auditable_type" = 'fleet'
  AND "audited_changes" ? 'imagePaths';
