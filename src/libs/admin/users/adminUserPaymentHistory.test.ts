import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PaymentPurpose,
  PaymentSource,
  PaymentStatus,
  SailingCardType,
} from '@/generated/prisma/enums';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  eventPaymentFindMany: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    payment: {
      findMany: mocks.eventPaymentFindMany,
    },
  },
}));

describe('listAdminUserPaymentHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns event payments as shared payment history rows', async () => {
    mocks.eventPaymentFindMany.mockResolvedValue([
      {
        amountCents: 2500,
        cardType: null,
        cardYear: null,
        createdAt: new Date('2026-05-21T16:00:00.000Z'),
        currency: 'usd',
        event: { name: 'Firefly Clinic', slug: 'firefly-clinic' },
        id: 'payment-1',
        legacyDescription: null,
        manualHandledAt: null,
        manualHandledBy: null,
        manualHandledNote: null,
        purpose: PaymentPurpose.event_payment,
        source: PaymentSource.stripe,
        status: PaymentStatus.paid,
        stripeReceiptUrl: 'https://pay.stripe.com/receipts/payment-1',
      },
      {
        amountCents: 1500,
        cardType: null,
        cardYear: null,
        createdAt: new Date('2026-05-20T16:00:00.000Z'),
        currency: 'usd',
        event: { name: 'Racing Deposit', slug: 'racing-deposit' },
        id: 'payment-2',
        legacyDescription: null,
        manualHandledAt: null,
        manualHandledBy: null,
        manualHandledNote: null,
        purpose: PaymentPurpose.event_payment,
        source: PaymentSource.stripe,
        status: PaymentStatus.disputed,
        stripeReceiptUrl: null,
      },
      {
        amountCents: 12_000,
        cardType: SailingCardType.racing,
        cardYear: 2026,
        createdAt: new Date('2026-05-19T16:00:00.000Z'),
        currency: 'usd',
        event: null,
        id: 'payment-3',
        legacyDescription: null,
        manualHandledAt: new Date('2026-05-19T17:00:00.000Z'),
        manualHandledBy: { name: 'Dock Master' },
        manualHandledNote: 'Admin issued sailing card without payment.',
        purpose: PaymentPurpose.membership,
        source: PaymentSource.legacy,
        status: PaymentStatus.paid,
        stripeReceiptUrl: null,
      },
    ]);
    const { listAdminUserPaymentHistory } =
      await import('@/libs/admin/users/adminUserPaymentHistory');

    await expect(listAdminUserPaymentHistory('user-1')).resolves.toEqual([
      {
        amountCents: 2500,
        cardType: null,
        cardYear: null,
        createdAt: new Date('2026-05-21T16:00:00.000Z'),
        currency: 'usd',
        detailHref: '/events/firefly-clinic',
        id: 'payment-1',
        manualHandledAt: null,
        manualHandledByName: null,
        manualHandledNote: null,
        purpose: 'event',
        receiptHref: 'https://pay.stripe.com/receipts/payment-1',
        source: PaymentSource.stripe,
        status: PaymentStatus.paid,
        title: 'Firefly Clinic',
      },
      {
        amountCents: 1500,
        cardType: null,
        cardYear: null,
        createdAt: new Date('2026-05-20T16:00:00.000Z'),
        currency: 'usd',
        detailHref: '/events/racing-deposit',
        id: 'payment-2',
        manualHandledAt: null,
        manualHandledByName: null,
        manualHandledNote: null,
        purpose: 'event',
        receiptHref: null,
        source: PaymentSource.stripe,
        status: PaymentStatus.disputed,
        title: 'Racing Deposit',
      },
      {
        amountCents: 12_000,
        cardType: SailingCardType.racing,
        cardYear: 2026,
        createdAt: new Date('2026-05-19T16:00:00.000Z'),
        currency: 'usd',
        detailHref: null,
        id: 'payment-3',
        manualHandledAt: new Date('2026-05-19T17:00:00.000Z'),
        manualHandledByName: 'Dock Master',
        manualHandledNote: 'Admin issued sailing card without payment.',
        purpose: 'membership',
        receiptHref: null,
        source: PaymentSource.legacy,
        status: PaymentStatus.paid,
        title: '',
      },
    ]);
    expect(mocks.eventPaymentFindMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: {
        amountCents: true,
        cardType: true,
        cardYear: true,
        createdAt: true,
        currency: true,
        event: { select: { name: true, slug: true } },
        id: true,
        legacyDescription: true,
        manualHandledAt: true,
        manualHandledBy: { select: { name: true } },
        manualHandledNote: true,
        purpose: true,
        source: true,
        status: true,
        stripeReceiptUrl: true,
      },
      where: { userId: 'user-1' },
    });
  });
});
