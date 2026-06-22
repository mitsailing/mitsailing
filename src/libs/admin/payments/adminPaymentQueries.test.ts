import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentPurpose, PaymentStatus } from '@/generated/prisma/enums';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  paymentCount: vi.fn(),
  paymentFindMany: vi.fn(),
  stripeWebhookEventFindFirst: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    payment: {
      count: mocks.paymentCount,
      findMany: mocks.paymentFindMany,
    },
    stripeWebhookEvent: {
      findFirst: mocks.stripeWebhookEventFindFirst,
    },
  },
}));

describe('listAdminPaymentLedgerData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.paymentCount.mockResolvedValue(0);
    mocks.stripeWebhookEventFindFirst.mockResolvedValue(null);
  });

  it('returns legacy payments without linked events or users', async () => {
    const legacyPayment = {
      amountCents: 5000,
      amountPaidCents: null,
      createdAt: new Date('2026-05-21T16:00:00.000Z'),
      event: null,
      id: 'payment-1',
      legacyCategory: 'regatta_registration',
      legacyDescription: 'Legacy regatta payment',
      legacySourceId: 'REG-1001',
      legacySourceTable: 'legacy.payments',
      payerEmail: 'sailor@example.com',
      payerName: 'Sailor One',
      status: PaymentStatus.needs_review,
      stripeDiscountMetadata: null,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      stripeReceiptUrl: null,
      user: null,
    };
    mocks.paymentFindMany.mockResolvedValue([legacyPayment]);
    const { listAdminPaymentLedgerData } =
      await import('./adminPaymentQueries');

    await expect(
      listAdminPaymentLedgerData({ status: PaymentStatus.needs_review })
    ).resolves.toEqual({
      latestWebhook: null,
      rows: [
        {
          amountCents: 5000,
          amountPaidCents: null,
          createdAt: new Date('2026-05-21T16:00:00.000Z'),
          event: null,
          id: 'payment-1',
          legacyCategory: 'regatta_registration',
          legacyDescription: 'Legacy regatta payment',
          legacySourceId: 'REG-1001',
          legacySourceTable: 'legacy.payments',
          payerEmail: 'sailor@example.com',
          payerName: 'Sailor One',
          receiptUrl: null,
          status: PaymentStatus.needs_review,
          stripeDiscountMetadata: null,
          stripeCheckoutSessionId: null,
          stripePaymentIntentId: null,
          user: null,
        },
      ],
    });
    expect(mocks.paymentFindMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: {
        amountCents: true,
        amountPaidCents: true,
        createdAt: true,
        event: { select: { name: true, slug: true } },
        id: true,
        legacyCategory: true,
        legacyDescription: true,
        legacySourceId: true,
        legacySourceTable: true,
        payerEmail: true,
        payerName: true,
        status: true,
        stripeDiscountMetadata: true,
        stripeCheckoutSessionId: true,
        stripePaymentIntentId: true,
        stripeReceiptUrl: true,
        user: { select: { email: true, name: true } },
      },
      skip: 0,
      take: 50,
      where: {
        AND: [
          {
            OR: [
              { purpose: PaymentPurpose.event_payment },
              { purpose: PaymentPurpose.membership },
            ],
          },
          { status: PaymentStatus.needs_review },
        ],
      },
    });
  });

  it('searches legacy payment identifiers and payer fields', async () => {
    mocks.paymentFindMany.mockResolvedValue([]);
    const { listAdminPaymentLedgerData } =
      await import('./adminPaymentQueries');

    await listAdminPaymentLedgerData({ query: 'legacy-1001', status: 'all' });

    expect(mocks.paymentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: [
                { purpose: PaymentPurpose.event_payment },
                { purpose: PaymentPurpose.membership },
              ],
            },
            {
              OR: [
                {
                  event: {
                    name: { contains: 'legacy-1001', mode: 'insensitive' },
                  },
                },
                {
                  user: {
                    email: { contains: 'legacy-1001', mode: 'insensitive' },
                  },
                },
                {
                  user: {
                    name: { contains: 'legacy-1001', mode: 'insensitive' },
                  },
                },
                {
                  legacyDescription: {
                    contains: 'legacy-1001',
                    mode: 'insensitive',
                  },
                },
                { legacySourceId: { contains: 'legacy-1001' } },
                {
                  payerEmail: {
                    contains: 'legacy-1001',
                    mode: 'insensitive',
                  },
                },
                {
                  payerName: {
                    contains: 'legacy-1001',
                    mode: 'insensitive',
                  },
                },
                { stripeCheckoutSessionId: { contains: 'legacy-1001' } },
                { stripePaymentIntentId: { contains: 'legacy-1001' } },
              ],
            },
          ],
        },
      })
    );
  });

  it('includes membership payments in the ledger scope', async () => {
    mocks.paymentFindMany.mockResolvedValue([]);
    const { listAdminPaymentLedgerData } =
      await import('./adminPaymentQueries');

    await listAdminPaymentLedgerData({ status: 'all' });

    expect(mocks.paymentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: [
                { purpose: PaymentPurpose.event_payment },
                { purpose: PaymentPurpose.membership },
              ],
            },
          ],
        },
      })
    );
  });

  it('returns paid legacy membership payments linked to users', async () => {
    const legacyMembershipPayment = {
      amountCents: 12_000,
      amountPaidCents: null,
      createdAt: new Date('2026-05-29T16:00:00.000Z'),
      event: null,
      id: 'payment-membership-1',
      legacyCategory: 'racing',
      legacyDescription: '2026 Pavilion racing sailing card',
      legacySourceId: 'legacy-membership-1001',
      legacySourceTable: 'legacy.payments',
      payerEmail: 'grace@example.com',
      payerName: 'Grace Hopper',
      status: PaymentStatus.paid,
      stripeDiscountMetadata: null,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      stripeReceiptUrl: null,
      user: { email: 'grace@example.com', name: 'Grace Hopper' },
    };
    mocks.paymentFindMany.mockResolvedValue([legacyMembershipPayment]);
    const { listAdminPaymentLedgerData } =
      await import('./adminPaymentQueries');

    await expect(
      listAdminPaymentLedgerData({ query: 'grace@example.com', status: 'all' })
    ).resolves.toEqual({
      latestWebhook: null,
      rows: [
        {
          amountCents: 12_000,
          amountPaidCents: null,
          createdAt: new Date('2026-05-29T16:00:00.000Z'),
          event: null,
          id: 'payment-membership-1',
          legacyCategory: 'racing',
          legacyDescription: '2026 Pavilion racing sailing card',
          legacySourceId: 'legacy-membership-1001',
          legacySourceTable: 'legacy.payments',
          payerEmail: 'grace@example.com',
          payerName: 'Grace Hopper',
          receiptUrl: null,
          status: PaymentStatus.paid,
          stripeDiscountMetadata: null,
          stripeCheckoutSessionId: null,
          stripePaymentIntentId: null,
          user: { email: 'grace@example.com', name: 'Grace Hopper' },
        },
      ],
    });
  });
});
