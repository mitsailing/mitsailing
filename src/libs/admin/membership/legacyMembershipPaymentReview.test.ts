import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PaymentPurpose,
  PaymentSource,
  PaymentStatus,
  SailingCardType,
} from '@/generated/prisma/enums';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  paymentFindMany: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    payment: {
      findMany: mocks.paymentFindMany,
    },
  },
}));

describe('listLegacyMembershipPaymentReviewRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only legacy membership payments needing review', async () => {
    const row = {
      amountCents: 12_000,
      cardType: SailingCardType.racing,
      cardYear: 2027,
      createdAt: new Date('2026-05-29T16:00:00.000Z'),
      id: 'payment-1',
      legacyCategory: 'Racing',
      legacyDescription: 'Racing Card 2026-2027 for unknown-sailor',
      legacySettled: false,
      legacySourceId: '1001',
      legacySourceTable: 'payments',
      payerEmail: 'unknown@example.com',
      payerName: 'Unknown Sailor',
      user: null,
    };
    mocks.paymentFindMany.mockResolvedValue([row]);
    const { listLegacyMembershipPaymentReviewRows } =
      await import('./legacyMembershipPaymentReview');

    await expect(listLegacyMembershipPaymentReviewRows()).resolves.toEqual([
      {
        amountCents: 12_000,
        cardType: SailingCardType.racing,
        cardYear: 2027,
        createdAt: new Date('2026-05-29T16:00:00.000Z'),
        id: 'payment-1',
        legacyCategory: 'Racing',
        legacyDescription: 'Racing Card 2026-2027 for unknown-sailor',
        legacySettled: false,
        legacySourceId: '1001',
        legacySourceTable: 'payments',
        payerEmail: 'unknown@example.com',
        payerName: 'Unknown Sailor',
        reviewReason: 'no_user_match',
        user: null,
      },
    ]);
    expect(mocks.paymentFindMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: {
        amountCents: true,
        cardType: true,
        cardYear: true,
        createdAt: true,
        id: true,
        legacyCategory: true,
        legacyDescription: true,
        legacySettled: true,
        legacySourceId: true,
        legacySourceTable: true,
        payerEmail: true,
        payerName: true,
        user: { select: { email: true, id: true, name: true } },
      },
      where: {
        purpose: PaymentPurpose.membership,
        source: PaymentSource.legacy,
        status: PaymentStatus.needs_review,
      },
    });
  });

  it('labels linked unsettled rows as unsettled legacy payments', async () => {
    mocks.paymentFindMany.mockResolvedValue([
      {
        amountCents: 12_000,
        cardType: SailingCardType.racing,
        cardYear: 2027,
        createdAt: new Date('2026-05-29T16:00:00.000Z'),
        id: 'payment-2',
        legacyCategory: 'Racing',
        legacyDescription: 'Racing Card 2026-2027 for sailor',
        legacySettled: false,
        legacySourceId: '1002',
        legacySourceTable: 'payments',
        payerEmail: 'sailor@example.com',
        payerName: 'Known Sailor',
        user: {
          email: 'sailor@example.com',
          id: 'user-1',
          name: 'Known Sailor',
        },
      },
    ]);
    const { listLegacyMembershipPaymentReviewRows } =
      await import('./legacyMembershipPaymentReview');

    await expect(
      listLegacyMembershipPaymentReviewRows()
    ).resolves.toMatchObject([
      {
        id: 'payment-2',
        reviewReason: 'unsettled_legacy_payment',
        user: {
          email: 'sailor@example.com',
          id: 'user-1',
          name: 'Known Sailor',
        },
      },
    ]);
  });
});
