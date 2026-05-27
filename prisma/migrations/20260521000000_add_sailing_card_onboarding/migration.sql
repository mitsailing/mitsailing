CREATE TYPE "sailing_affiliation" AS ENUM (
    'MIT_STUDENT',
    'MIT_FACULTY',
    'MIT_STAFF',
    'MIT_ALUM',
    'MIT_FAMILY',
    'MIT_AFFILIATE',
    'WELLESLEY',
    'BRANDEIS',
    'NORTHEASTERN',
    'WINSOR',
    'BROOKS',
    'NROTC',
    'OTHER_STUDENT',
    'OTHER_NON_STUDENT',
    'NON_MIT'
);

CREATE TYPE "mit_data_warehouse_person_type" AS ENUM (
    'CURRENT_STUDENT',
    'CURRENT_STAFF',
    'OTHER'
);

CREATE TYPE "event_sailing_card_requirement" AS ENUM (
    'NONE',
    'CURRENT_CARD'
);

CREATE TYPE "legal_agreement_acceptance_source" AS ENUM (
    'SAILING_CARD_ONBOARDING',
    'EVENT_REGISTRATION'
);

CREATE TYPE "sailing_card_request_status" AS ENUM (
    'pending',
    'approved',
    'cancelled'
);

CREATE TYPE "sailing_card_type" AS ENUM (
    'normal',
    'racing',
    'team_racing'
);

ALTER TABLE "user"
ADD COLUMN "first_name" TEXT,
ADD COLUMN "last_name" TEXT,
ADD COLUMN "emergency_contact_email" TEXT,
ADD COLUMN "sailing_affiliation" "sailing_affiliation",
ADD COLUMN "mit_id" TEXT,
ADD COLUMN "mit_class_year" TEXT,
ADD COLUMN "mit_data_warehouse_verified_at" TIMESTAMP(3),
ADD COLUMN "sailing_card_number" INTEGER,
ADD COLUMN "sailing_card_year" INTEGER,
ADD COLUMN "sailing_card_expires_on" DATE,
ADD COLUMN "sailing_card_requested_at" TIMESTAMP(3),
ADD COLUMN "sailing_card_issued_at" TIMESTAMP(3),
ADD COLUMN "sailing_card_issued_by_user_id" TEXT,
ADD COLUMN "sailing_card_swim_agreement_initials" TEXT,
ADD COLUMN "sailing_card_swim_agreement_initialed_at" TIMESTAMP(3);

ALTER TABLE "user"
ADD CONSTRAINT "user_mit_id_normalized"
CHECK ("mit_id" IS NULL OR "mit_id" ~ '^[0-9]{9}$');

ALTER TABLE "user"
ADD CONSTRAINT "user_sailing_card_number_year_complete"
CHECK (
    ("sailing_card_number" IS NULL AND "sailing_card_year" IS NULL) OR
    ("sailing_card_number" IS NOT NULL AND "sailing_card_year" IS NOT NULL)
);

CREATE UNIQUE INDEX "user_mit_id_key" ON "user"("mit_id");
CREATE UNIQUE INDEX "user_sailing_card_year_sailing_card_number_key" ON "user"("sailing_card_year", "sailing_card_number");
CREATE INDEX "user_sailing_card_requested_at_idx" ON "user"("sailing_card_requested_at");
CREATE INDEX "user_sailing_card_expires_on_idx" ON "user"("sailing_card_expires_on");
CREATE INDEX "user_sailing_affiliation_idx" ON "user"("sailing_affiliation");

ALTER TABLE "user"
ADD CONSTRAINT "user_sailing_card_issued_by_user_id_fkey"
FOREIGN KEY ("sailing_card_issued_by_user_id")
REFERENCES "user"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE TABLE "mit_data_warehouse_people" (
    "mit_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "kerberos" TEXT,
    "class_year" TEXT,
    "person_type" "mit_data_warehouse_person_type" NOT NULL,
    "loaded_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mit_data_warehouse_people_pkey" PRIMARY KEY ("mit_id")
);

ALTER TABLE "mit_data_warehouse_people"
ADD CONSTRAINT "mit_data_warehouse_people_mit_id_normalized"
CHECK ("mit_id" ~ '^[0-9]{9}$');

CREATE INDEX "mit_data_warehouse_people_person_type_idx" ON "mit_data_warehouse_people"("person_type");
CREATE UNIQUE INDEX "mit_data_warehouse_people_kerberos_key" ON "mit_data_warehouse_people"("kerberos");

CREATE TABLE "legal_agreement_acceptances" (
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

CREATE INDEX "legal_agreement_acceptances_user_id_source_accepted_at_idx" ON "legal_agreement_acceptances"("user_id", "source", "accepted_at");
CREATE INDEX "legal_agreement_acceptances_source_source_record_id_idx" ON "legal_agreement_acceptances"("source", "source_record_id");

ALTER TABLE "legal_agreement_acceptances"
ADD CONSTRAINT "legal_agreement_acceptances_user_id_fkey"
FOREIGN KEY ("user_id")
REFERENCES "user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

CREATE TABLE "sailing_card_requests" (
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

CREATE UNIQUE INDEX "sailing_card_requests_user_id_card_year_key" ON "sailing_card_requests"("user_id", "card_year");
CREATE INDEX "sailing_card_requests_card_year_status_requested_at_idx" ON "sailing_card_requests"("card_year", "status", "requested_at");
CREATE INDEX "sailing_card_requests_legal_agreement_acceptance_id_idx" ON "sailing_card_requests"("legal_agreement_acceptance_id");
CREATE INDEX "sailing_card_requests_approved_by_user_id_idx" ON "sailing_card_requests"("approved_by_user_id");

ALTER TABLE "sailing_card_requests"
ADD CONSTRAINT "sailing_card_requests_user_id_fkey"
FOREIGN KEY ("user_id")
REFERENCES "user"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "sailing_card_requests"
ADD CONSTRAINT "sailing_card_requests_legal_agreement_acceptance_id_fkey"
FOREIGN KEY ("legal_agreement_acceptance_id")
REFERENCES "legal_agreement_acceptances"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "sailing_card_requests"
ADD CONSTRAINT "sailing_card_requests_approved_by_user_id_fkey"
FOREIGN KEY ("approved_by_user_id")
REFERENCES "user"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "events"
ADD COLUMN "sailing_card_requirement" "event_sailing_card_requirement" NOT NULL DEFAULT 'NONE';
