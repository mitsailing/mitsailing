import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EventRegistrationStatus,
  PaymentPurpose,
  PaymentStatus,
} from '@/generated/prisma/enums';

const mocks = vi.hoisted(() => ({
  eventFindFirst: vi.fn(),
  paymentFindFirst: vi.fn(),
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
    payment: {
      findFirst: mocks.paymentFindFirst,
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
    mocks.paymentFindFirst.mockResolvedValue({
      amountCents: 1500,
      id: 'payment-1',
      status: PaymentStatus.pending,
      stripeReceiptUrl: null,
    });
  });

  it('loads the latest event payment from pending or approved registrations', async () => {
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
        id: 'payment-1',
        receiptUrl: null,
        status: PaymentStatus.pending,
      },
    });
    expect(mocks.paymentFindFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: {
        amountCents: true,
        id: true,
        status: true,
        stripeReceiptUrl: true,
      },
      where: {
        purpose: PaymentPurpose.event_payment,
        registration: {
          eventId: 'event-1',
          status: {
            in: [
              EventRegistrationStatus.approved,
              EventRegistrationStatus.pending,
            ],
          },
        },
        userId: 'user-1',
      },
    });
  });

  it('returns the event shell when no payment exists for payable registrations', async () => {
    mocks.paymentFindFirst.mockResolvedValue(null);
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
      payment: null,
    });
  });

  it('returns null when the event is not public', async () => {
    mocks.eventFindFirst.mockResolvedValue(null);
    const { getEventPaymentCheckoutPageData } =
      await import('@/libs/mit-sailing/eventPaymentCheckoutQueries');

    await expect(
      getEventPaymentCheckoutPageData('private-event', 'user-1')
    ).resolves.toBeNull();

    expect(mocks.paymentFindFirst).not.toHaveBeenCalled();
  });
});

describe('eventPaymentCheckoutIsPayable', () => {
  it('identifies checkout statuses that can open Stripe', async () => {
    const { eventPaymentCheckoutIsPayable } =
      await import('@/libs/mit-sailing/eventPaymentCheckoutQueries');

    expect(eventPaymentCheckoutIsPayable(PaymentStatus.checkout_created)).toBe(
      true
    );
    expect(eventPaymentCheckoutIsPayable(PaymentStatus.past_due)).toBe(true);
    expect(eventPaymentCheckoutIsPayable(PaymentStatus.pending)).toBe(true);
    expect(eventPaymentCheckoutIsPayable(PaymentStatus.paid)).toBe(false);
    expect(eventPaymentCheckoutIsPayable(PaymentStatus.handled)).toBe(false);
  });
});
