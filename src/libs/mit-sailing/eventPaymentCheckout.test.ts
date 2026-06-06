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

  it('returns expandable Stripe ids from object payloads', async () => {
    mocks.stripeCheckoutSessionsCreate.mockResolvedValue({
      client_secret: 'cs_secret_123',
      customer: { id: 'cus_object' },
      id: 'cs_123',
      payment_intent: { id: 'pi_object' },
    });

    await expect(
      createEmbeddedEventPaymentCheckoutSession({
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
      })
    ).resolves.toEqual({
      checkoutSessionId: 'cs_123',
      clientSecret: 'cs_secret_123',
      stripeCustomerId: 'cus_object',
      stripePaymentIntentId: 'pi_object',
    });
  });

  it('rejects event checkout amounts that Stripe cannot charge', async () => {
    await expect(
      createEmbeddedEventPaymentCheckoutSession({
        payment: {
          amountCents: 0,
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
      })
    ).rejects.toThrow('Event payment amount must be positive integer cents.');

    expect(mocks.stripeCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it('rejects event checkout currencies outside usd', async () => {
    await expect(
      createEmbeddedEventPaymentCheckoutSession({
        payment: {
          amountCents: 2500,
          currency: 'cad',
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
      })
    ).rejects.toThrow('Event payments only support usd currency.');

    expect(mocks.stripeCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it('fails closed when Stripe omits the embedded client secret', async () => {
    mocks.stripeCheckoutSessionsCreate.mockResolvedValue({
      client_secret: null,
      customer: null,
      id: 'cs_123',
      payment_intent: null,
    });

    await expect(
      createEmbeddedEventPaymentCheckoutSession({
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
      })
    ).rejects.toThrow(
      'Stripe did not return an embedded checkout client secret.'
    );
  });

  it('returns deterministic E2E checkout details without loading Stripe', async () => {
    vi.resetModules();
    vi.doMock('@/libs/Env', () => ({ Env: { IS_E2E: '1' } }));
    const isolated = await import('@/libs/stripe/stripeCheckoutSessions');

    await expect(
      isolated.createEmbeddedEventPaymentCheckoutSession({
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
      })
    ).resolves.toEqual({
      checkoutSessionId: 'cs_test_e2e_payment-1',
      clientSecret: 'cs_test_e2e_secret_payment-1',
      stripeCustomerId: 'cus_test_e2e_payment-1',
      stripePaymentIntentId: 'pi_test_e2e_payment-1',
    });

    vi.doUnmock('@/libs/Env');
    vi.resetModules();
  });

  it('loads the runtime Stripe client when no client is injected', async () => {
    vi.resetModules();
    vi.doMock('@/libs/Env', () => ({ Env: { IS_E2E: '0' } }));
    vi.doMock('@/libs/stripe/stripeClient', () => ({
      getStripeClient: () => ({
        checkout: {
          sessions: {
            create: mocks.stripeCheckoutSessionsCreate,
          },
        },
      }),
    }));

    const isolated = await import('@/libs/stripe/stripeCheckoutSessions');

    await expect(
      isolated.createEmbeddedEventPaymentCheckoutSession({
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
      })
    ).resolves.toMatchObject({
      checkoutSessionId: 'cs_123',
      clientSecret: 'cs_secret_123',
    });

    expect(mocks.stripeCheckoutSessionsCreate).toHaveBeenCalled();
    vi.doUnmock('@/libs/Env');
    vi.doUnmock('@/libs/stripe/stripeClient');
    vi.resetModules();
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
    expect(mocks.eventPaymentUpdateMany).toHaveBeenNthCalledWith(1, {
      data: { status: PaymentStatus.checkout_created },
      where: {
        id: 'payment-1',
        status: PaymentStatus.pending,
        stripeCheckoutSessionId: null,
      },
    });
    expect(mocks.eventPaymentUpdateMany).toHaveBeenNthCalledWith(2, {
      data: {
        status: PaymentStatus.checkout_created,
        stripeCheckoutSessionId: 'cs_123',
        stripePaymentIntentId: 'pi_123',
      },
      where: {
        id: 'payment-1',
        status: PaymentStatus.checkout_created,
        stripeCheckoutSessionId: null,
      },
    });
  });

  it('returns null without calling Stripe when payment claim fails', async () => {
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
    expect(mocks.stripeCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it('returns null while another request is creating the checkout session', async () => {
    mocks.eventPaymentFindFirst.mockResolvedValue({
      amountCents: 2500,
      currency: 'usd',
      eventId: 'event-1',
      id: 'payment-1',
      registrationId: 'registration-1',
      selectedFeeDescription: 'Adult entry',
      status: PaymentStatus.checkout_created,
      stripeCheckoutSessionId: null,
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

    expect(mocks.eventPaymentUpdateMany).not.toHaveBeenCalled();
    expect(mocks.stripeCheckoutSessionsCreate).not.toHaveBeenCalled();
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

  it('returns null when the payment cannot be converted for Stripe', async () => {
    mocks.eventPaymentFindFirst.mockResolvedValue({
      amountCents: 2500,
      currency: 'usd',
      eventId: null,
      id: 'payment-1',
      registrationId: 'registration-1',
      selectedFeeDescription: 'Adult entry',
      status: PaymentStatus.pending,
      stripeCheckoutSessionId: null,
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

    expect(mocks.eventPaymentUpdateMany).not.toHaveBeenCalled();
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

  it('stores Stripe customer ids when Checkout returns one', async () => {
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
    mocks.stripeCheckoutSessionsCreate.mockResolvedValue({
      client_secret: 'cs_secret_123',
      customer: 'cus_123',
      id: 'cs_123',
      payment_intent: null,
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
    ).resolves.toBe('cs_secret_123');

    expect(mocks.eventPaymentUpdateMany).toHaveBeenLastCalledWith({
      data: {
        status: PaymentStatus.checkout_created,
        stripeCheckoutSessionId: 'cs_123',
        stripeCustomerId: 'cus_123',
      },
      where: {
        id: 'payment-1',
        status: PaymentStatus.checkout_created,
        stripeCheckoutSessionId: null,
      },
    });
  });

  it('returns null when another request wins after Stripe creates a session', async () => {
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
    mocks.eventPaymentUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

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

  it('builds a localized return url without trimming needed', () => {
    expect(
      buildEventPaymentCheckoutReturnUrl({
        appUrl: 'https://sailing.mit.edu',
        locale: 'en',
        slug: 'intro',
      })
    ).toBe(
      'https://sailing.mit.edu/events/intro/checkout?session_id={CHECKOUT_SESSION_ID}'
    );
  });
});
