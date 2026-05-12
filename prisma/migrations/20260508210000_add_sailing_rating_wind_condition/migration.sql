ALTER TABLE "sailing_ratings"
  ADD COLUMN "wind_condition" TEXT;

ALTER TABLE "sailing_ratings"
  ADD CONSTRAINT "sailing_ratings_wind_condition_check"
  CHECK (
    "wind_condition" IS NULL
    OR "wind_condition" IN ('Low', 'Medium', 'Medium-strong', 'Strong', 'All')
  );
