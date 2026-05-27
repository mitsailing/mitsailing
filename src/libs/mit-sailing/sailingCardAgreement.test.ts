import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LegalAgreementAcceptanceSource } from '@/generated/prisma/enums';
import {
  sailingCardAgreement,
  sailingCardAgreementHash,
} from '@/libs/mit-sailing/sailingCardAgreement';

const prismaSchema = readFileSync('prisma/schema.prisma', 'utf8');
const zenstackSchema = readFileSync('zenstack/schema.zmodel', 'utf8');
const onboardingMigration = readFileSync(
  'prisma/migrations/20260521000000_add_sailing_card_onboarding/migration.sql',
  'utf8'
);

describe('sailingCardAgreement', () => {
  it('owns the v1 swim agreement copy in code', () => {
    expect(sailingCardAgreement).toEqual({
      label:
        'I have read and agree to the swim agreement and liability release.',
      text: [
        'I certify that I can swim and understand that boating and sailing involve inherent risks.',
        'I agree to follow MIT Sailing staff instructions, safety rules, and equipment-use requirements.',
        'I understand this acknowledgement is required before my sailing card request can be reviewed.',
      ].join('\n\n'),
      version: '2026-05-27',
    });
  });

  it('hashes agreement text deterministically', () => {
    expect(sailingCardAgreementHash()).toBe(
      createHash('sha256').update(sailingCardAgreement.text).digest('hex')
    );
    expect(sailingCardAgreementHash()).toHaveLength(64);
  });
});

describe('legal agreement acceptance schema', () => {
  it('stores onboarding agreement evidence without event registration coupling', () => {
    expect(LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING).toBe(
      'SAILING_CARD_ONBOARDING'
    );
    expect(LegalAgreementAcceptanceSource.EVENT_REGISTRATION).toBe(
      'EVENT_REGISTRATION'
    );
    expect(prismaSchema).toContain('model LegalAgreementAcceptance');
    expect(prismaSchema).toContain('source LegalAgreementAcceptanceSource');
    expect(prismaSchema).toContain('agreementLabel');
    expect(prismaSchema).toContain('agreementVersion');
    expect(prismaSchema).toContain('agreementHash');
    expect(prismaSchema).toContain('sourceRecordId');
    expect(prismaSchema).toContain('user User @relation');
    expect(prismaSchema).not.toContain('eventRegistrationId');
  });

  it('creates an append-only onboarding ledger in the migration and ZenStack policies', () => {
    expect(zenstackSchema).toContain('model LegalAgreementAcceptance');
    expect(zenstackSchema).toContain("@@deny('update,delete', true)");
    expect(onboardingMigration).toContain(
      'CREATE TYPE "legal_agreement_acceptance_source" AS ENUM'
    );
    expect(onboardingMigration).toContain(
      'CREATE TABLE "legal_agreement_acceptances"'
    );
    expect(onboardingMigration).toContain(
      'CREATE INDEX "legal_agreement_acceptances_user_id_source_accepted_at_idx"'
    );
  });
});
