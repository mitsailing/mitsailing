import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LegalAgreementAcceptanceSource,
  PaymentPurpose,
  PaymentSource,
  PaymentStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import {
  sailingCardAgreement,
  sailingCardAgreementHash,
} from '@/libs/mit-sailing/sailingCardAgreement';
import { getCurrentSailingCardYear } from '@/libs/mit-sailing/sailingCardValidity';
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
  paymentFindMany: vi.fn(),
  sailingCardRequestFindFirst: vi.fn(),
  sailingCardRequestFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  userFindMany: vi.fn(),
  userAuditFindMany: vi.fn(),
}));

function pendingRequestFixture(options: {
  readonly cardType?: SailingCardType;
  readonly email?: string;
  readonly firstName?: string;
}) {
  return {
    cardType: options.cardType ?? SailingCardType.racing,
    firstName: options.firstName ?? 'Pending',
    hasFitnessMembership: null,
    id: 'request-1',
    lastName: 'Racer',
    legalAgreementAcceptance: {
      acceptedAt: new Date('2026-05-21T16:00:00.000Z'),
      agreementVersion: 'v1',
    },
    mitId: null,
    requestedAt: new Date('2026-05-22T16:00:00.000Z'),
    sailingAffiliation: 'MIT_ALUM',
    user: {
      email: options.email ?? 'pending@example.com',
      id: 'user-1',
    },
  };
}

function membershipPaymentFixture(options: {
  readonly source: PaymentSource;
  readonly status: PaymentStatus;
  readonly stripeReceiptUrl?: string | null;
}) {
  return {
    cardType: SailingCardType.racing,
    source: options.source,
    status: options.status,
    stripeReceiptUrl: options.stripeReceiptUrl ?? null,
    userId: 'user-1',
  };
}

async function expectPendingPaymentAccess(options: {
  readonly access: 'blocked' | 'paid';
  readonly payments: ReturnType<typeof membershipPaymentFixture>[];
  readonly requestEmail: string;
  readonly requestName: string;
}) {
  mocks.sailingCardRequestFindMany.mockResolvedValue([
    pendingRequestFixture({
      email: options.requestEmail,
      firstName: options.requestName,
    }),
  ]);
  mocks.paymentFindMany.mockResolvedValue(options.payments);
  const { listPendingSailingCardRequests } =
    await import('@/libs/admin/cards/adminSailingCardUiQueries');

  await expect(listPendingSailingCardRequests()).resolves.toMatchObject([
    {
      paymentAccess: options.access,
    },
  ]);
}

vi.mock('@/libs/DB', () => ({
  prisma: {
    payment: {
      findMany: mocks.paymentFindMany,
    },
    sailingCardRequest: {
      findFirst: mocks.sailingCardRequestFindFirst,
      findMany: mocks.sailingCardRequestFindMany,
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
    mocks.paymentFindMany.mockResolvedValue([]);
    mocks.sailingCardRequestFindFirst.mockResolvedValue(null);
  });

  it('returns pending requests with latest onboarding agreement acceptance', async () => {
    mocks.sailingCardRequestFindMany.mockResolvedValue([
      {
        cardType: SailingCardType.normal,
        firstName: 'Submitted',
        hasFitnessMembership: false,
        id: 'user-1',
        lastName: 'Name',
        mitId: '987654321',
        sailingCardRequestedAt: new Date('2026-05-22T16:00:00.000Z'),
        requestedAt: new Date('2026-05-22T16:00:00.000Z'),
        sailingAffiliation: 'MIT_ALUM',
        legalAgreementAcceptance: {
          acceptedAt: new Date('2026-05-21T16:00:00.000Z'),
          agreementVersion: 'v1',
        },
        user: {
          email: 'ada@mit.edu',
          id: 'user-1',
          mitId: '123456789',
          name: 'Ada Lovelace',
          sailingAffiliation: 'MIT_STUDENT',
        },
      },
    ]);
    const { listPendingSailingCardRequests } =
      await import('@/libs/admin/cards/adminSailingCardUiQueries');

    await expect(listPendingSailingCardRequests()).resolves.toEqual([
      {
        agreementAcceptedAt: new Date('2026-05-21T16:00:00.000Z'),
        agreementVersion: 'v1',
        cardType: SailingCardType.normal,
        email: 'ada@mit.edu',
        hasFitnessMembership: false,
        id: 'user-1',
        mitId: '987654321',
        name: 'Submitted Name',
        paymentAccess: 'none',
        requestedAt: new Date('2026-05-22T16:00:00.000Z'),
        sailingAffiliation: 'MIT_ALUM',
      },
    ]);
    expect(mocks.userFindMany).not.toHaveBeenCalled();
    expect(mocks.sailingCardRequestFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cardYear: getCurrentSailingCardYear(),
          status: 'pending',
        }),
      })
    );
    expect(mocks.paymentFindMany).toHaveBeenCalledWith({
      select: {
        cardType: true,
        source: true,
        status: true,
        stripeReceiptUrl: true,
        userId: true,
      },
      orderBy: { createdAt: 'desc' },
      where: {
        cardYear: getCurrentSailingCardYear(),
        purpose: PaymentPurpose.membership,
        userId: { in: ['user-1'] },
      },
    });
  });

  it('marks pending paid card requests with current payment access', async () => {
    await expectPendingPaymentAccess({
      access: 'paid',
      payments: [
        membershipPaymentFixture({
          source: PaymentSource.legacy,
          status: PaymentStatus.paid,
        }),
      ],
      requestEmail: 'paid@example.com',
      requestName: 'Paid',
    });
  });

  it('marks pending paid card requests with current payment blockers', async () => {
    await expectPendingPaymentAccess({
      access: 'blocked',
      payments: [
        membershipPaymentFixture({
          source: PaymentSource.legacy,
          status: PaymentStatus.needs_review,
        }),
      ],
      requestEmail: 'blocked@example.com',
      requestName: 'Blocked',
    });
  });

  it('keeps paid access when a newer legacy row needs review', async () => {
    await expectPendingPaymentAccess({
      access: 'paid',
      payments: [
        membershipPaymentFixture({
          source: PaymentSource.legacy,
          status: PaymentStatus.needs_review,
        }),
        membershipPaymentFixture({
          source: PaymentSource.stripe,
          status: PaymentStatus.paid,
          stripeReceiptUrl: 'https://pay.stripe.test/receipts/1',
        }),
      ],
      requestEmail: 'mixed@example.com',
      requestName: 'Mixed',
    });
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
