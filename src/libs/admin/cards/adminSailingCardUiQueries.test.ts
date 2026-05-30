import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LegalAgreementAcceptanceSource } from '@/generated/prisma/enums';
import {
  sailingCardAgreement,
  sailingCardAgreementHash,
} from '@/libs/mit-sailing/sailingCardAgreement';
import type * as SailingCardValidityModule from '@/libs/mit-sailing/sailingCardValidity';

vi.mock('server-only', () => ({}));

vi.mock('@/libs/mit-sailing/sailingCardValidity', async () => {
  const actual = await vi.importActual<typeof SailingCardValidityModule>(
    '@/libs/mit-sailing/sailingCardValidity'
  );
  return {
    ...actual,
    getCurrentSailingCardYear: () => 2026,
  };
});

const mocks = vi.hoisted(() => ({
  sailingCardRequestFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  userFindMany: vi.fn(),
  userAuditFindMany: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    sailingCardRequest: {
      findFirst: mocks.sailingCardRequestFindFirst,
    },
    user: {
      findUnique: mocks.userFindUnique,
      findMany: mocks.userFindMany,
    },
    userAudit: {
      findMany: mocks.userAuditFindMany,
    },
  },
}));

describe('adminSailingCardUiQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sailingCardRequestFindFirst.mockResolvedValue(null);
  });

  it('returns old card history even after many unrelated audits', async () => {
    mocks.userAuditFindMany.mockResolvedValue([
      ...Array.from({ length: 20 }, (_, index) => ({
        auditedChanges: { after: { name: `User ${index}` }, before: null },
        createdAt: new Date(
          `2026-09-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
        ),
        id: `audit-${index}`,
      })),
      {
        auditedChanges: {
          after: { sailingCardNumber: 42, sailingCardYear: 2027 },
          before: { sailingCardNumber: null, sailingCardYear: null },
        },
        createdAt: new Date('2026-08-01T16:00:00.000Z'),
        id: 'card-audit',
      },
    ]);
    const { getAdminSailingCardHistory } =
      await import('@/libs/admin/cards/adminSailingCardUiQueries');

    await expect(getAdminSailingCardHistory('user-1')).resolves.toEqual([
      {
        createdAt: new Date('2026-08-01T16:00:00.000Z'),
        id: 'card-audit',
        number: 42,
        year: 2027,
      },
    ]);
    expect(mocks.userAuditFindMany.mock.calls[0]?.[0]).not.toHaveProperty(
      'take'
    );
  });

  it('uses the previous card number for reissue history', async () => {
    mocks.userAuditFindMany.mockResolvedValue([
      {
        auditedChanges: {
          after: { sailingCardNumber: 60, sailingCardYear: 2027 },
          before: { sailingCardNumber: 42, sailingCardYear: 2026 },
        },
        createdAt: new Date('2026-08-01T16:00:00.000Z'),
        id: 'reissue-audit',
      },
    ]);
    const { getAdminSailingCardHistory } =
      await import('@/libs/admin/cards/adminSailingCardUiQueries');

    await expect(getAdminSailingCardHistory('user-1')).resolves.toEqual([
      {
        createdAt: new Date('2026-08-01T16:00:00.000Z'),
        id: 'reissue-audit',
        number: 42,
        year: 2026,
      },
    ]);
  });

  it('returns user card summary with latest onboarding agreement acceptance', async () => {
    const summary = {
      legalAgreementAcceptances: [
        {
          acceptedAt: new Date('2026-05-21T16:00:00.000Z'),
          agreementHash: sailingCardAgreementHash(),
          agreementVersion: sailingCardAgreement.version,
        },
      ],
      paymentBypassRequest: {
        paymentBypassAt: new Date('2026-05-22T16:00:00.000Z'),
        paymentBypassBy: { name: 'Payment Admin' },
        paymentBypassNote: 'Admin issued sailing card without payment.',
      },
      sailingCardRequests: [
        {
          paymentBypassAt: null,
          paymentBypassBy: null,
          paymentBypassNote: null,
        },
      ],
      sailingCardExpiresOn: new Date('2027-05-31T04:00:00.000Z'),
      sailingCardIssuedAt: new Date('2026-05-22T16:00:00.000Z'),
      sailingCardIssuedBy: {
        name: 'Admin User',
      },
      sailingCardNumber: 42,
      sailingCardRequestedAt: new Date('2026-05-20T16:00:00.000Z'),
      sailingCardSwimAgreementInitialedAt: new Date('2026-05-20T16:05:00.000Z'),
      sailingCardSwimAgreementInitials: 'AL',
      sailingCardYear: 2026,
    };
    const userSummary = {
      ...summary,
      paymentBypassRequest: undefined,
    };
    mocks.userFindUnique.mockResolvedValue(userSummary);
    mocks.sailingCardRequestFindFirst.mockResolvedValue(
      summary.paymentBypassRequest
    );
    const { getAdminUserSailingCardSummary } =
      await import('@/libs/admin/cards/adminSailingCardUiQueries');

    await expect(getAdminUserSailingCardSummary('user-1')).resolves.toEqual(
      summary
    );
    expect(mocks.userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          legalAgreementAcceptances: {
            orderBy: { acceptedAt: 'desc' },
            select: {
              acceptedAt: true,
              agreementHash: true,
              agreementVersion: true,
            },
            take: 1,
            where: {
              agreementHash: sailingCardAgreementHash(),
              agreementVersion: sailingCardAgreement.version,
              source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
            },
          },
          sailingCardRequests: {
            orderBy: [{ cardYear: 'desc' }, { requestedAt: 'desc' }],
            select: {
              cardType: true,
              cardYear: true,
              hasFitnessMembership: true,
              issuedCardNumber: true,
              paymentBypassAt: true,
              paymentBypassBy: {
                select: {
                  name: true,
                },
              },
              paymentBypassNote: true,
              requestedAt: true,
              sailingAffiliation: true,
              status: true,
            },
            take: 1,
          },
        }),
        where: { id: 'user-1' },
      })
    );
    expect(mocks.sailingCardRequestFindFirst).toHaveBeenCalledWith({
      orderBy: { paymentBypassAt: 'desc' },
      select: {
        cardType: true,
        cardYear: true,
        hasFitnessMembership: true,
        issuedCardNumber: true,
        paymentBypassAt: true,
        paymentBypassBy: {
          select: {
            name: true,
          },
        },
        paymentBypassNote: true,
        requestedAt: true,
        sailingAffiliation: true,
        status: true,
      },
      where: {
        paymentBypassAt: { not: null },
        userId: 'user-1',
      },
    });
  });
});
