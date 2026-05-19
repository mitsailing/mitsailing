WITH ranked_verifications AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY "identifier"
      ORDER BY "created_at" DESC, "id" DESC
    ) AS duplicate_rank
  FROM "verification"
)
DELETE FROM "verification" AS verification
USING ranked_verifications
WHERE verification.ctid = ranked_verifications.ctid
  AND ranked_verifications.duplicate_rank > 1;

DROP INDEX IF EXISTS "verification_identifier_idx";

CREATE UNIQUE INDEX "verification_identifier_key" ON "verification"("identifier");
