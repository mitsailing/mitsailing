ALTER TABLE "legal_agreement_acceptances"
  ADD COLUMN "accepted_user_id" TEXT,
  ADD COLUMN "accepted_user_name" TEXT,
  ADD COLUMN "accepted_user_email" VARCHAR(255);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "legal_agreement_acceptances" AS acceptance
    WHERE NOT EXISTS (
      SELECT 1
      FROM "user"
      WHERE "user"."id" = acceptance."user_id"
    )
  ) THEN
    RAISE EXCEPTION
      'legal_agreement_acceptances contains user_id values without matching user rows; remediate before snapshotting accepted user identity';
  END IF;
END
$$;

UPDATE "legal_agreement_acceptances" AS acceptance
SET
  "accepted_user_id" = acceptance."user_id",
  "accepted_user_name" = "user"."name",
  "accepted_user_email" = "user"."email"
FROM "user"
WHERE "user"."id" = acceptance."user_id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "legal_agreement_acceptances"
    WHERE "accepted_user_id" IS NULL
      OR "accepted_user_name" IS NULL
      OR "accepted_user_email" IS NULL
  ) THEN
    RAISE EXCEPTION
      'legal_agreement_acceptances accepted user snapshot backfill failed; remediate rows before enforcing active-user consistency';
  END IF;
END
$$;

ALTER TABLE "legal_agreement_acceptances"
  DROP CONSTRAINT "legal_agreement_acceptances_user_id_fkey";

ALTER TABLE "legal_agreement_acceptances"
  ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "legal_agreement_acceptances"
  ADD CONSTRAINT "legal_agreement_acceptances_user_snapshot_consistency"
  CHECK (
    "user_id" IS NULL OR (
      "accepted_user_id" = "user_id"
      AND "accepted_user_name" IS NOT NULL
      AND "accepted_user_email" IS NOT NULL
    )
  );

ALTER TABLE "legal_agreement_acceptances"
  ADD CONSTRAINT "legal_agreement_acceptances_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "user"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "legal_agreement_acceptances_accepted_user_id_source_accepted_at_idx"
ON "legal_agreement_acceptances"("accepted_user_id", "source", "accepted_at");

CREATE OR REPLACE FUNCTION user_account_deletion_privacy_cleanup()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "audit_log"
  SET
    "user_id" = NULL,
    "ip_address" = NULL,
    "user_agent" = NULL,
    "metadata" = NULL
  WHERE "user_id" = OLD."id";

  UPDATE "legal_agreement_acceptances"
  SET
    "user_id" = NULL,
    "accepted_user_id" = NULL,
    "accepted_user_name" = NULL,
    "accepted_user_email" = NULL,
    "ip_address" = NULL,
    "user_agent" = NULL
  WHERE "user_id" = OLD."id"
    OR "accepted_user_id" = OLD."id";

  UPDATE "user_audit"
  SET
    "user_id" = NULL,
    "impersonated_user_id" = NULL,
    "remote_address" = NULL
  WHERE "user_id" = OLD."id"
    OR "impersonated_user_id" = OLD."id";

  DELETE FROM "user_audit"
  WHERE "auditable_type" = 'user'
    AND "auditable_id" = OLD."id";

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE "payments"
  DROP CONSTRAINT IF EXISTS "payments_registration_id_event_id_fkey",
  DROP CONSTRAINT IF EXISTS "payments_registration_id_event_id_user_id_fkey",
  DROP CONSTRAINT IF EXISTS "payments_user_id_fkey";

DROP INDEX IF EXISTS "payments_registration_id_event_id_key";
DROP INDEX IF EXISTS "event_registrations_id_event_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "event_registrations_id_event_id_user_id_key"
ON "event_registrations"("id", "event_id", "user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "payments_registration_id_event_id_user_id_key"
ON "payments"("registration_id", "event_id", "user_id");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "payments"
    WHERE "registration_id" IS NOT NULL
      AND (
        "event_id" IS NULL
        OR "user_id" IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM "event_registrations"
          WHERE "event_registrations"."id" = "payments"."registration_id"
            AND "event_registrations"."event_id" = "payments"."event_id"
            AND "event_registrations"."user_id" = "payments"."user_id"
        )
      )
  ) THEN
    RAISE EXCEPTION
      'payments table contains registration_id rows that would violate payments_registration_id_event_id_user_id_fkey; remediate payments/event_registrations before adding the composite foreign key';
  END IF;
END
$$;

ALTER TABLE "payments"
ADD CONSTRAINT "payments_registration_id_event_id_user_id_fkey"
FOREIGN KEY ("registration_id", "event_id", "user_id")
REFERENCES "event_registrations"("id", "event_id", "user_id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "payments"
ADD CONSTRAINT "payments_user_id_fkey"
FOREIGN KEY ("user_id")
REFERENCES "user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "pg_trigger"
    WHERE "tgname" = 'user_account_deletion_privacy_cleanup_trigger'
  ) THEN
    CREATE TRIGGER user_account_deletion_privacy_cleanup_trigger
    BEFORE DELETE ON "user"
    FOR EACH ROW
    EXECUTE FUNCTION user_account_deletion_privacy_cleanup();
  END IF;
END
$$;
