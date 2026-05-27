DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'legal_agreement_acceptance_source'
    ) THEN
        CREATE TYPE "legal_agreement_acceptance_source" AS ENUM (
            'SAILING_CARD_ONBOARDING',
            'EVENT_REGISTRATION'
        );
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "legal_agreement_acceptances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" "legal_agreement_acceptance_source" NOT NULL,
    "source_record_id" TEXT,
    "agreement_label" TEXT NOT NULL,
    "agreement_version" VARCHAR(40) NOT NULL,
    "agreement_hash" VARCHAR(64) NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL,
    "ip_address" VARCHAR(80),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_agreement_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "legal_agreement_acceptances_user_id_source_accepted_at_idx" ON "legal_agreement_acceptances"("user_id", "source", "accepted_at");
CREATE INDEX IF NOT EXISTS "legal_agreement_acceptances_source_source_record_id_idx" ON "legal_agreement_acceptances"("source", "source_record_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'legal_agreement_acceptances_user_id_fkey'
    ) THEN
        ALTER TABLE "legal_agreement_acceptances"
        ADD CONSTRAINT "legal_agreement_acceptances_user_id_fkey"
        FOREIGN KEY ("user_id")
        REFERENCES "user"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    END IF;
END
$$;
