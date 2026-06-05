import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { LegalAgreementAcceptanceSource } from '@/generated/prisma/enums';
import type { getAdminUserSailingCardSummary as getAdminUserSailingCardSummaryFn } from '@/libs/admin/cards/adminSailingCardUiQueries';
import type { prisma as dbPrisma } from '@/libs/DB';
import {
  sailingCardAgreement,
  sailingCardAgreementHash,
} from '@/libs/mit-sailing/sailingCardAgreement';

vi.mock('server-only', () => ({}));

const shouldRunSummaryDatabaseTest =
  process.env.RUN_DATABASE_TESTS === '1' &&
  Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!shouldRunSummaryDatabaseTest)(
  'getAdminUserSailingCardSummary database query',
  () => {
    let prisma: typeof dbPrisma | null = null;
    let getAdminUserSailingCardSummary: typeof getAdminUserSailingCardSummaryFn;
    const idPrefix = `admin_card_summary_${randomUUID()}`;
    const issuerUserId = `${idPrefix}_issuer`;
    const targetUserId = `${idPrefix}_target`;
    const olderAgreementAcceptedAt = new Date('2026-05-20T16:00:00.000Z');
    const latestAgreementAcceptedAt = new Date('2026-05-22T16:00:00.000Z');
    const requestedAt = new Date('2026-05-20T15:30:00.000Z');
    const initialedAt = new Date('2026-05-20T15:35:00.000Z');
    const issuedAt = new Date('2026-05-23T14:00:00.000Z');
    const expiresOn = new Date('2027-07-15T00:00:00.000Z');
    const originalDatabaseUrl = process.env.DATABASE_URL;
    const originalTestDatabaseUrl = process.env.TEST_DATABASE_URL;

    function restoreDatabaseEnv() {
      if (originalDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalDatabaseUrl;
      }
      if (originalTestDatabaseUrl === undefined) {
        delete process.env.TEST_DATABASE_URL;
      } else {
        process.env.TEST_DATABASE_URL = originalTestDatabaseUrl;
      }
    }

    async function deleteSummaryFixtures(client: typeof dbPrisma) {
      await client.legalAgreementAcceptance.deleteMany({
        where: { userId: targetUserId },
      });
      await client.user.deleteMany({ where: { id: targetUserId } });
      await client.user.deleteMany({ where: { id: issuerUserId } });
    }

    beforeAll(async () => {
      if (!originalTestDatabaseUrl) {
        throw new Error('TEST_DATABASE_URL is required for summary test.');
      }
      process.env.DATABASE_URL = originalTestDatabaseUrl;
      delete process.env.TEST_DATABASE_URL;
      const { prisma: loadedPrisma } = await import('@/libs/DB');
      const {
        getAdminUserSailingCardSummary: loadedGetAdminUserSailingCardSummary,
      } = await import('@/libs/admin/cards/adminSailingCardUiQueries');
      prisma = loadedPrisma;
      getAdminUserSailingCardSummary = loadedGetAdminUserSailingCardSummary;
      await deleteSummaryFixtures(loadedPrisma);
      await loadedPrisma.user.create({
        data: {
          email: `${issuerUserId}@example.test`,
          emailVerified: true,
          id: issuerUserId,
          name: 'Card Admin',
        },
      });
      await loadedPrisma.user.create({
        data: {
          email: `${targetUserId}@example.test`,
          emailVerified: true,
          id: targetUserId,
          name: 'Ada Lovelace',
          sailingCardExpiresOn: expiresOn,
          sailingCardIssuedAt: issuedAt,
          sailingCardIssuedByUserId: issuerUserId,
          sailingCardNumber: 61,
          sailingCardRequestedAt: requestedAt,
          sailingCardSwimAgreementInitialedAt: initialedAt,
          sailingCardSwimAgreementInitials: 'AL',
          sailingCardYear: 2026,
        },
      });
      await loadedPrisma.legalAgreementAcceptance.createMany({
        data: [
          {
            acceptedAt: olderAgreementAcceptedAt,
            acceptedUserEmail: `${targetUserId}@example.test`,
            acceptedUserId: targetUserId,
            acceptedUserName: 'Ada Lovelace',
            agreementHash: sailingCardAgreementHash(),
            agreementLabel: sailingCardAgreement.label,
            agreementVersion: sailingCardAgreement.version,
            source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
            sourceRecordId: null,
            userId: targetUserId,
          },
          {
            acceptedAt: new Date('2026-05-24T16:00:00.000Z'),
            acceptedUserEmail: `${targetUserId}@example.test`,
            acceptedUserId: targetUserId,
            acceptedUserName: 'Ada Lovelace',
            agreementHash: '0'.repeat(64),
            agreementLabel: sailingCardAgreement.label,
            agreementVersion: sailingCardAgreement.version,
            source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
            sourceRecordId: null,
            userId: targetUserId,
          },
          {
            acceptedAt: new Date('2026-05-25T16:00:00.000Z'),
            acceptedUserEmail: `${targetUserId}@example.test`,
            acceptedUserId: targetUserId,
            acceptedUserName: 'Ada Lovelace',
            agreementHash: sailingCardAgreementHash(),
            agreementLabel: sailingCardAgreement.label,
            agreementVersion: sailingCardAgreement.version,
            source: LegalAgreementAcceptanceSource.EVENT_REGISTRATION,
            sourceRecordId: null,
            userId: targetUserId,
          },
          {
            acceptedAt: latestAgreementAcceptedAt,
            acceptedUserEmail: `${targetUserId}@example.test`,
            acceptedUserId: targetUserId,
            acceptedUserName: 'Ada Lovelace',
            agreementHash: sailingCardAgreementHash(),
            agreementLabel: sailingCardAgreement.label,
            agreementVersion: sailingCardAgreement.version,
            source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
            sourceRecordId: null,
            userId: targetUserId,
          },
        ],
      });
    });

    afterAll(async () => {
      const client = prisma;
      if (client) {
        await deleteSummaryFixtures(client);
        await client.$disconnect();
      }
      restoreDatabaseEnv();
    });

    it('returns card fields with latest matching onboarding acceptance', async () => {
      const summary = await getAdminUserSailingCardSummary(targetUserId);

      expect(summary).toEqual({
        gymMembershipVerifiedAt: null,
        legalAgreementAcceptances: [
          {
            acceptedAt: latestAgreementAcceptedAt,
            agreementHash: sailingCardAgreementHash(),
            agreementVersion: sailingCardAgreement.version,
          },
        ],
        paymentBypassRequest: null,
        sailingCardExpiresOn: expiresOn,
        sailingCardIssuedAt: issuedAt,
        sailingCardIssuedBy: { name: 'Card Admin' },
        sailingCardNumber: 61,
        sailingCardRequestedAt: requestedAt,
        sailingCardRequests: [],
        sailingCardSwimAgreementInitialedAt: initialedAt,
        sailingCardSwimAgreementInitials: 'AL',
        sailingCardYear: 2026,
      });
    });
  }
);
