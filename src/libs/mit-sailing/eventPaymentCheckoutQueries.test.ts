import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentPurpose, PaymentStatus } from '@/generated/prisma/enums';

const mocks = vi.hoisted(() => ({
  eventFindFirst: vi.fn(),
  eventRegistrationFindFirst: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('react', () => ({
  cache: <T>(fn: T) => fn,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    event: {
      findFirst: mocks.eventFindFirst,
    },
    eventRegistration: {
      findFirst: mocks.eventRegistrationFindFirst,
    },
  },
}));

describe('getEventPaymentCheckoutPageData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eventFindFirst.mockResolvedValue({
      id: 'event-1',
      name: 'Intro Sail',
      slug: 'intro-sail',
    });
  });

  it('loads payment from the latest approved registration', async () => {
    mocks.eventRegistrationFindFirst.mockResolvedValue({
      payment: {
        amountCents: 1500,
        id: 'payment-new',
        purpose: PaymentPurpose.event_payment,
        status: PaymentStatus.pending,
        stripeReceiptUrl: null,
      },
    });
    const { getEventPaymentCheckoutPageData } =
      await import('@/libs/mit-sailing/eventPaymentCheckoutQueries');

    await expect(
      getEventPaymentCheckoutPageData('intro-sail', 'user-1')
    ).resolves.toEqual({
      event: {
        id: 'event-1',
        name: 'Intro Sail',
        slug: 'intro-sail',
      },
      payment: {
        amountCents: 1500,
        id: 'payment-new',
        receiptUrl: null,
        status: PaymentStatus.pending,
      },
    });
    expect(mocks.eventRegistrationFindFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: {
        payment: {
          select: {
            amountCents: true,
            id: true,
            purpose: true,
            status: true,
            stripeReceiptUrl: true,
          },
        },
      },
      where: {
        eventId: 'event-1',
        status: 'approved',
        userId: 'user-1',
      },
    });
  });
});
