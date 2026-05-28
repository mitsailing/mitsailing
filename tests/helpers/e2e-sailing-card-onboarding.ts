import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { sailingCardAgreement } from '@/libs/mit-sailing/sailingCardAgreementContent';
import { getCurrentSailingCardYear } from '@/libs/mit-sailing/sailingCardValidity';

const sailingCardAgreementHash = createHash('sha256')
  .update(sailingCardAgreement.text)
  .digest('hex');

async function insertLegalAgreementAcceptance(options: {
  readonly id: string;
  readonly pool: Pool | PoolClient;
  readonly userAgent: string;
  readonly userId: string;
}) {
  await options.pool.query(
    `INSERT INTO "legal_agreement_acceptances"
      ("id", "user_id", "source", "agreement_label", "agreement_version", "agreement_hash", "accepted_at", "ip_address", "user_agent", "created_at")
     VALUES
      ($1, $2, 'SAILING_CARD_ONBOARDING', $3, $4, $5, NOW(), '127.0.0.1', $6, NOW())`,
    [
      options.id,
      options.userId,
      sailingCardAgreement.label,
      sailingCardAgreement.version,
      sailingCardAgreementHash,
      options.userAgent,
    ]
  );
}

async function upsertSailingCardRequest(options: {
  readonly legalAgreementAcceptanceId: string;
  readonly pool: Pool | PoolClient;
  readonly userId: string;
}) {
  const result = await options.pool.query(
    `INSERT INTO "sailing_card_requests"
      ("id", "user_id", "card_year", "status", "card_type", "legal_agreement_acceptance_id", "requested_at",
       "first_name", "last_name", "sailing_affiliation", "mit_id", "mit_class_year", "date_of_birth",
       "phone", "emergency_contact_name", "emergency_contact_phone", "created_at", "updated_at")
     SELECT
       $1, u."id", $3, 'pending', 'normal', $2, NOW(),
       COALESCE(NULLIF(u."first_name", ''), 'E2E'),
       COALESCE(NULLIF(u."last_name", ''), 'Sailor'),
       COALESCE(u."sailing_affiliation", 'MIT_AFFILIATE'), u."mit_id",
       u."mit_class_year", DATE '1990-01-01',
       COALESCE(NULLIF(u."phone", ''), '+16172531234'),
       COALESCE(NULLIF(u."emergency_contact_name", ''), 'Taylor Test'),
       COALESCE(NULLIF(u."emergency_contact_phone", ''), '+16172534321'), NOW(), NOW()
     FROM "user" u
     WHERE u."id" = $4
     ON CONFLICT ("user_id", "card_year") DO UPDATE
     SET "status" = 'pending',
         "card_type" = 'normal',
         "legal_agreement_acceptance_id" = EXCLUDED."legal_agreement_acceptance_id",
         "requested_at" = EXCLUDED."requested_at",
         "first_name" = EXCLUDED."first_name",
         "last_name" = EXCLUDED."last_name",
         "sailing_affiliation" = EXCLUDED."sailing_affiliation",
         "mit_id" = EXCLUDED."mit_id",
         "mit_class_year" = EXCLUDED."mit_class_year",
         "date_of_birth" = EXCLUDED."date_of_birth",
         "phone" = EXCLUDED."phone",
         "emergency_contact_name" = EXCLUDED."emergency_contact_name",
         "emergency_contact_phone" = EXCLUDED."emergency_contact_phone",
         "updated_at" = NOW()`,
    [
      `e2e-sailing-card-request-${randomUUID()}`,
      options.legalAgreementAcceptanceId,
      getCurrentSailingCardYear(),
      options.userId,
    ]
  );
  if (result.rowCount === 0) {
    throw new Error(
      `Failed to insert sailing card request: user ${options.userId} for year ${getCurrentSailingCardYear()} not found`
    );
  }
}

export async function insertCurrentSailingCardOnboardingAcceptance(options: {
  pool: Pool | PoolClient;
  userAgent: string;
  userId: string;
}): Promise<void> {
  const legalAgreementAcceptanceId = `e2e-onboarding-agreement-${randomUUID()}`;
  await insertLegalAgreementAcceptance({
    id: legalAgreementAcceptanceId,
    pool: options.pool,
    userAgent: options.userAgent,
    userId: options.userId,
  });
  await upsertSailingCardRequest({
    legalAgreementAcceptanceId,
    pool: options.pool,
    userId: options.userId,
  });
}
