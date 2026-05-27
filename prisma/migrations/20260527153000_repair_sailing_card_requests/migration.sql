DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'sailing_card_request_status'
    ) THEN
        CREATE TYPE "sailing_card_request_status" AS ENUM (
            'pending',
            'approved',
            'cancelled'
        );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'sailing_card_type'
    ) THEN
        CREATE TYPE "sailing_card_type" AS ENUM (
            'normal',
            'racing',
            'team_racing'
        );
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "sailing_card_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "card_year" INTEGER NOT NULL,
    "status" "sailing_card_request_status" NOT NULL DEFAULT 'pending',
    "card_type" "sailing_card_type" NOT NULL DEFAULT 'normal',
    "legal_agreement_acceptance_id" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "approved_by_user_id" TEXT,
    "issued_card_number" INTEGER,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "sailing_affiliation" "sailing_affiliation" NOT NULL,
    "mit_id" TEXT,
    "mit_class_year" TEXT,
    "date_of_birth" DATE NOT NULL,
    "phone" TEXT NOT NULL,
    "emergency_contact_name" TEXT NOT NULL,
    "emergency_contact_phone" TEXT NOT NULL,
    "emergency_contact_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sailing_card_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sailing_card_requests_user_id_card_year_key"
ON "sailing_card_requests"("user_id", "card_year");

CREATE INDEX IF NOT EXISTS "sailing_card_requests_card_year_status_requested_at_idx"
ON "sailing_card_requests"("card_year", "status", "requested_at");

CREATE INDEX IF NOT EXISTS "sailing_card_requests_legal_agreement_acceptance_id_idx"
ON "sailing_card_requests"("legal_agreement_acceptance_id");

CREATE INDEX IF NOT EXISTS "sailing_card_requests_approved_by_user_id_idx"
ON "sailing_card_requests"("approved_by_user_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = '"sailing_card_requests"'::regclass
          AND conname = 'sailing_card_requests_user_id_fkey'
    ) THEN
        ALTER TABLE "sailing_card_requests"
        ADD CONSTRAINT "sailing_card_requests_user_id_fkey"
        FOREIGN KEY ("user_id")
        REFERENCES "user"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = '"sailing_card_requests"'::regclass
          AND conname = 'sailing_card_requests_legal_agreement_acceptance_id_fkey'
    ) THEN
        ALTER TABLE "sailing_card_requests"
        ADD CONSTRAINT "sailing_card_requests_legal_agreement_acceptance_id_fkey"
        FOREIGN KEY ("legal_agreement_acceptance_id")
        REFERENCES "legal_agreement_acceptances"("id")
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = '"sailing_card_requests"'::regclass
          AND conname = 'sailing_card_requests_approved_by_user_id_fkey'
    ) THEN
        ALTER TABLE "sailing_card_requests"
        ADD CONSTRAINT "sailing_card_requests_approved_by_user_id_fkey"
        FOREIGN KEY ("approved_by_user_id")
        REFERENCES "user"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END
$$;
