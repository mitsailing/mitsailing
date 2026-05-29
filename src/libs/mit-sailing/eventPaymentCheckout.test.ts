import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentPurpose, PaymentStatus } from '@/generated/prisma/enums';
import {
  buildEventPaymentCheckoutReturnUrl,
  createEventPaymentCheckoutClientSecret,
} from '@/libs/mit-sailing/eventPaymentCheckout';
import { createEmbeddedEventPaymentCheckoutSession } from '@/libs/stripe/stripeCheckoutSessions';

const mocks = vi.hoisted(() => ({
  eventPaymentFindFirst: vi.fn(),
  eventPaymentUpdateMany: vi.fn(),
  stripeCheckoutSessionsCreate: vi.fn(),
}));

vi.mock('server-only', () => ({}));

describe('createEmbeddedEventPaymentCheckoutSession', () => {
  beforeEach(() => {
    mocks.stripeCheckoutSessionsCreate.mockReset();
    mocks.stripeCheckoutSessionsCreate.mockResolvedValue({
      client_secret: 'cs_secret_123',
      customer: 'cus_123',
      id: 'cs_123',
      payment_intent: 'pi_123',
    });
  });

  it('creates embedded checkout session params without payment method types', async () => {
    const result = await createEmbeddedEventPaymentCheckoutSession({
      payment: {
        amountCents: 2500,
        currency: 'usd',
        eventId: 'event-1',
        id: 'payment-1',
        registrationId: 'registration-1',
        selectedFeeDescription: 'Adult entry',
        userId: 'user-1',
      },
      returnUrl: 'https://sailing.mit.edu/events/intro/checkout/return',
      stripe: {
        checkout: {
          sessions: {
            create: mocks.stripeCheckoutSessionsCreate,
          },
        },
      },
    });

    expect(result).toEqual({
      checkoutSessionId: 'cs_123',
      clientSecret: 'cs_secret_123',
      stripeCustomerId: 'cus_123',
      stripePaymentIntentId: 'pi_123',
    });
    expect(mocks.stripeCheckoutSessionsCreate).toHaveBeenCalledWith(
      {
        client_reference_id: 'payment-1',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Adult entry',
              },
              unit_amount: 2500,
            },
            quantity: 1,
          },
        ],
        metadata: {
          eventId: 'event-1',
          paymentId: 'payment-1',
          registrationId: 'registration-1',
          userId: 'user-1',
        },
        mode: 'payment',
        payment_intent_data: {
          metadata: {
            eventId: 'event-1',
            paymentId: 'payment-1',
            registrationId: 'registration-1',
            userId: 'user-1',
          },
        },
        return_url: 'https://sailing.mit.edu/events/intro/checkout/return',
        ui_mode: 'embedded',
      },
      {
        idempotencyKey: 'event-payment-checkout-payment-1',
      }
    );
    expect(
      mocks.stripeCheckoutSessionsCreate.mock.calls[0]?.[0]
    ).not.toHaveProperty('payment_method_types');
  });
});

describe('createEventPaymentCheckoutClientSecret', () => {
  beforeEach(() => {
    mocks.eventPaymentFindFirst.mockReset();
    mocks.eventPaymentUpdateMany.mockReset();
    mocks.stripeCheckoutSessionsCreate.mockReset();
    mocks.stripeCheckoutSessionsCreate.mockResolvedValue({
      client_secret: 'cs_secret_123',
      customer: null,
      id: 'cs_123',
      payment_intent: 'pi_123',
    });
  });

  it('returns a client secret for the payment owner', async () => {
    mocks.eventPaymentFindFirst.mockResolvedValue({
      amountCents: 2500,
      currency: 'usd',
      eventId: 'event-1',
      id: 'payment-1',
      registrationId: 'registration-1',
      selectedFeeDescription: 'Adult entry',
      status: PaymentStatus.pending,
      stripeCheckoutSessionId: null,
      userId: 'user-1',
    });
    mocks.eventPaymentUpdateMany.mockResolvedValue({ count: 1 });

    await expect(
      createEventPaymentCheckoutClientSecret({
        db: {
          payment: {
            findFirst: mocks.eventPaymentFindFirst,
            updateMany: mocks.eventPaymentUpdateMany,
          },
        },
        paymentId: 'payment-1',
        returnUrl: 'https://sailing.mit.edu/events/intro/checkout/return',
        stripe: {
          checkout: {
            sessions: {
              create: mocks.stripeCheckoutSessionsCreate,
            },
          },
        },
        userId: 'user-1',
      })
    ).resolves.toBe('cs_secret_123');

    expect(mocks.eventPaymentFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'payment-1',
        purpose: PaymentPurpose.event_payment,
        OR: [
          { userId: 'user-1' },
          { event: { admins: { some: { adminUserId: 'user-1' } } } },
        ],
      },
    });
    expect(mocks.eventPaymentUpdateMany).toHaveBeenCalledWith({
      data: {
        status: PaymentStatus.checkout_created,
        stripeCheckoutSessionId: 'cs_123',
        stripePaymentIntentId: 'pi_123',
      },
      where: {
        id: 'payment-1',
        status: PaymentStatus.pending,
        stripeCheckoutSessionId: null,
      },
    });
  });

  it('returns null when payment status changes during checkout creation', async () => {
    mocks.eventPaymentFindFirst.mockResolvedValue({
      amountCents: 2500,
      currency: 'usd',
      eventId: 'event-1',
      id: 'payment-1',
      registrationId: 'registration-1',
      selectedFeeDescription: 'Adult entry',
      status: PaymentStatus.pending,
      stripeCheckoutSessionId: null,
      userId: 'user-1',
    });
    mocks.eventPaymentUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      createEventPaymentCheckoutClientSecret({
        db: {
          payment: {
            findFirst: mocks.eventPaymentFindFirst,
            updateMany: mocks.eventPaymentUpdateMany,
          },
        },
        paymentId: 'payment-1',
        returnUrl: 'https://sailing.mit.edu/events/intro/checkout/return',
        stripe: {
          checkout: {
            sessions: {
              create: mocks.stripeCheckoutSessionsCreate,
            },
          },
        },
        userId: 'user-1',
      })
    ).resolves.toBeNull();

    expect(mocks.eventPaymentUpdateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: PaymentStatus.checkout_created,
      }),
      where: {
        id: 'payment-1',
        status: PaymentStatus.pending,
        stripeCheckoutSessionId: null,
      },
    });
  });

  it('returns null when the requester cannot access payment', async () => {
    mocks.eventPaymentFindFirst.mockResolvedValue(null);

    await expect(
      createEventPaymentCheckoutClientSecret({
        db: {
          payment: {
            findFirst: mocks.eventPaymentFindFirst,
            updateMany: mocks.eventPaymentUpdateMany,
          },
        },
        paymentId: 'payment-1',
        returnUrl: 'https://sailing.mit.edu/events/intro/checkout/return',
        stripe: {
          checkout: {
            sessions: {
              create: mocks.stripeCheckoutSessionsCreate,
            },
          },
        },
        userId: 'other-user',
      })
    ).resolves.toBeNull();
    expect(mocks.stripeCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it('returns null for terminal paid payment', async () => {
    mocks.eventPaymentFindFirst.mockResolvedValue({
      amountCents: 2500,
      currency: 'usd',
      eventId: 'event-1',
      id: 'payment-1',
      registrationId: 'registration-1',
      selectedFeeDescription: 'Adult entry',
      status: PaymentStatus.paid,
      stripeCheckoutSessionId: 'cs_paid',
      userId: 'user-1',
    });

    await expect(
      createEventPaymentCheckoutClientSecret({
        db: {
          payment: {
            findFirst: mocks.eventPaymentFindFirst,
            updateMany: mocks.eventPaymentUpdateMany,
          },
        },
        paymentId: 'payment-1',
        returnUrl: 'https://sailing.mit.edu/events/intro/checkout/return',
        stripe: {
          checkout: {
            sessions: {
              create: mocks.stripeCheckoutSessionsCreate,
            },
          },
        },
        userId: 'user-1',
      })
    ).resolves.toBeNull();
  });
});

describe('buildEventPaymentCheckoutReturnUrl', () => {
  it('builds an absolute return url with session id placeholder', () => {
    expect(
      buildEventPaymentCheckoutReturnUrl({
        appUrl: 'https://sailing.mit.edu/',
        slug: 'intro sail',
      })
    ).toBe(
      'https://sailing.mit.edu/events/intro%20sail/checkout?session_id={CHECKOUT_SESSION_ID}'
    );
  });
});
