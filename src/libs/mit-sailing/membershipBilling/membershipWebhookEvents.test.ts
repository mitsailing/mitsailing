import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma/client';
import {
  MembershipPaymentKind,
  PaymentStatus,
  SailingCardSubscriptionStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import { handleMembershipStripeWebhookEvent } from '@/libs/mit-sailing/membershipBilling/membershipWebhookEvents';
import type { StripeWebhookDb } from '@/libs/stripe/stripeWebhookEvents';

vi.mock('server-only', () => ({}));

const stripeEventCreated = 1_777_636_800;

type MembershipWebhookTestDb = Omit<
  StripeWebhookDb,
  'payment' | 'sailingCardSubscription'
> & {
  payment: StripeWebhookDb['payment'] & {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  sailingCardSubscription: {
    findFirst: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};

function membershipPayment(overrides: Record<string, unknown> = {}) {
  return {
    amountCents: 7000,
    cardType: SailingCardType.racing,
    cardYear: 2026,
    currency: 'usd',
    id: 'payment_1',
    membershipInitialPriceId: 'price_local_spring',
    membershipPaymentKind: MembershipPaymentKind.initial,
    membershipRenewalPriceId: 'price_local_annual',
    membershipSubscriptionId: null,
    purpose: 'membership',
    status: PaymentStatus.checkout_created,
    stripeCheckoutSessionId: 'cs_test',
    stripeCustomerId: 'cus_test',
    stripeInvoiceId: null,
    stripeSubscriptionId: null,
    userId: 'user_1',
    ...overrides,
  };
}

function membershipEvent(type: string, object: Record<string, unknown>) {
  return {
    created: stripeEventCreated,
    data: { object },
    id: `evt_${type.replaceAll('.', '_')}`,
    type,
  };
}

function membershipMetadata(overrides: Record<string, unknown> = {}) {
  return {
    cardType: 'racing',
    domain: 'sailing_card_membership',
    localPaymentId: 'payment_1',
    renewalMembershipPriceId: 'price_local_annual',
    userId: 'user_1',
    ...overrides,
  };
}

function subscriptionObject(overrides: Record<string, unknown> = {}) {
  return {
    cancel_at_period_end: false,
    current_period_end: 1_784_088_000,
    current_period_start: 1_777_636_800,
    customer: 'cus_test',
    id: 'sub_test',
    items: {
      data: [
        {
          id: 'si_test',
          price: { id: 'price_annual', product: 'prod_membership' },
        },
      ],
    },
    metadata: membershipMetadata(),
    status: 'active',
    ...overrides,
  };
}

function paidInvoiceObject(overrides: Record<string, unknown> = {}) {
  return {
    amount_paid: 12_500,
    billing_reason: 'subscription_cycle',
    charge: 'ch_invoice',
    currency: 'usd',
    customer: 'cus_test',
    hosted_invoice_url: 'https://pay.stripe.com/invoice/test',
    id: 'in_test',
    invoice_pdf: 'https://pay.stripe.com/invoice/test/pdf',
    lines: {
      data: [{ period: { end: 1_815_619_200, start: 1_784_088_000 } }],
    },
    parent: { subscription_details: { metadata: membershipMetadata() } },
    payment_intent: 'pi_test',
    subscription: subscriptionObject({ status: 'active' }),
    ...overrides,
  };
}

function stripeInvoiceUniqueError(
  target: readonly string[] | string = ['stripeInvoiceId']
) {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`stripe_invoice_id`)',
    {
      clientVersion: 'test',
      code: 'P2002',
      meta: { target },
    }
  );
}

function createDb(
  options: {
    readonly payment?: ReturnType<typeof membershipPayment> | null;
    readonly subscription?: Record<string, unknown> | null;
  } = {}
): MembershipWebhookTestDb {
  const payment =
    options.payment === undefined ? membershipPayment() : options.payment;
  const subscription =
    options.subscription === undefined
      ? {
          cardType: SailingCardType.racing,
          id: 'local_sub_1',
          stripeCustomerId: 'cus_test',
          userId: 'user_1',
        }
      : options.subscription;
  const db: MembershipWebhookTestDb = {
    payment: {
      create: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(payment),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    eventPaymentNotification: {
      upsert: vi.fn(),
    },
    sailingCardSubscription: {
      findFirst: vi.fn().mockResolvedValue(subscription),
      upsert: vi.fn().mockResolvedValue({
        id: 'local_sub_1',
        userId: 'user_1',
      }),
    },
    stripeWebhookEvent: {
      createMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  return db;
}

function withoutPaymentWrites(db: MembershipWebhookTestDb): StripeWebhookDb {
  return {
    ...db,
    payment: {
      findFirst: db.payment.findFirst,
      updateMany: db.payment.updateMany,
    },
  };
}

describe('handleMembershipStripeWebhookEvent', () => {
  it('links completed checkout to a local subscription and shared payment row', async () => {
    const db = createDb({ subscription: null });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('checkout.session.completed', {
          customer: 'cus_test',
          id: 'cs_test',
          metadata: membershipMetadata(),
          payment_status: 'paid',
          subscription: subscriptionObject(),
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.sailingCardSubscription.upsert).toHaveBeenCalledWith({
      create: expect.objectContaining({
        cardType: SailingCardType.racing,
        status: SailingCardSubscriptionStatus.active,
        stripeCustomerId: 'cus_test',
        stripeSubscriptionId: 'sub_test',
        userId: 'user_1',
      }),
      update: expect.objectContaining({
        currentRenewalPriceId: 'price_local_annual',
        currentRenewalStripePriceId: 'price_annual',
        status: SailingCardSubscriptionStatus.active,
      }),
      where: { stripeSubscriptionId: 'sub_test' },
    });
    expect(db.sailingCardSubscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cardType: SailingCardType.racing,
          stripeSubscriptionId: { not: 'sub_test' },
          userId: 'user_1',
        }),
      })
    );
    expect(db.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activeCheckoutKey: null,
        membershipSubscriptionId: 'local_sub_1',
        status: PaymentStatus.paid,
        stripeSubscriptionId: 'sub_test',
      }),
      where: { id: 'payment_1', status: PaymentStatus.checkout_created },
    });
  });

  it('marks completed checkout active when Stripe sends only a subscription id', async () => {
    const db = createDb({ subscription: null });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('checkout.session.completed', {
          customer: 'cus_test',
          id: 'cs_test',
          metadata: membershipMetadata(),
          payment_status: 'paid',
          subscription: 'sub_test',
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.sailingCardSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: SailingCardSubscriptionStatus.active,
          stripeSubscriptionId: 'sub_test',
        }),
        update: expect.objectContaining({
          status: SailingCardSubscriptionStatus.active,
        }),
      })
    );
  });

  it('uses checkout metadata when legacy local payments lack card context', async () => {
    const db = createDb({
      payment: membershipPayment({
        cardType: null,
        membershipRenewalPriceId: null,
      }),
      subscription: null,
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('checkout.session.completed', {
          customer: 'cus_test',
          id: 'cs_test',
          metadata: membershipMetadata({
            cardType: SailingCardType.team_racing,
          }),
          payment_status: 'paid',
          subscription: subscriptionObject(),
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.sailingCardSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          cardType: SailingCardType.team_racing,
        }),
        update: expect.objectContaining({
          currentRenewalPriceId: null,
        }),
      })
    );
  });

  it('throws when completed checkout is missing subscription context', async () => {
    const db = createDb();

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('checkout.session.completed', {
          customer: null,
          id: 'cs_test',
          metadata: membershipMetadata(),
          payment_status: 'paid',
          subscription: null,
        }),
      })
    ).rejects.toThrow(
      'Membership checkout session is missing subscription data.'
    );
  });

  it('throws when completed checkout cannot find the local payment', async () => {
    const db = createDb({ payment: null });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('checkout.session.completed', {
          customer: 'cus_test',
          id: 'cs_test',
          metadata: membershipMetadata(),
          payment_status: 'paid',
          subscription: 'sub_test',
        }),
      })
    ).rejects.toThrow('Membership checkout payment not found.');
  });

  it('does not overwrite a newer local subscription with a stale Stripe event', async () => {
    const db = createDb();
    db.sailingCardSubscription.findFirst.mockResolvedValueOnce({
      cardType: SailingCardType.racing,
      id: 'local_sub_1',
      lastStripeSubscriptionEventCreatedAt: new Date(
        (stripeEventCreated + 60) * 1000
      ),
      stripeCustomerId: 'cus_test',
      userId: 'user_1',
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent(
          'customer.subscription.updated',
          subscriptionObject({ status: 'active' })
        ),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.sailingCardSubscription.upsert).not.toHaveBeenCalled();
    expect(db.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        membershipSubscriptionId: 'local_sub_1',
        stripeSubscriptionId: 'sub_test',
      }),
      where: { id: 'payment_1', status: PaymentStatus.checkout_created },
    });
  });

  it.each([
    ['active', SailingCardSubscriptionStatus.active],
    ['canceled', SailingCardSubscriptionStatus.canceled],
    ['incomplete', SailingCardSubscriptionStatus.incomplete],
    ['incomplete_expired', SailingCardSubscriptionStatus.incomplete_expired],
    ['past_due', SailingCardSubscriptionStatus.past_due],
    ['trialing', SailingCardSubscriptionStatus.trialing],
    ['paused', SailingCardSubscriptionStatus.paused],
    ['unpaid', SailingCardSubscriptionStatus.unpaid],
    ['mystery', SailingCardSubscriptionStatus.incomplete],
    [undefined, SailingCardSubscriptionStatus.incomplete],
  ])(
    'maps subscription status %s from Stripe',
    async (status, expectedStatus) => {
      const db = createDb();
      db.sailingCardSubscription.findFirst
        .mockResolvedValueOnce({
          cardType: SailingCardType.racing,
          id: 'local_sub_1',
          stripeCustomerId: 'cus_test',
          userId: 'user_1',
        })
        .mockResolvedValueOnce(null);

      await expect(
        handleMembershipStripeWebhookEvent({
          db,
          event: membershipEvent(
            'customer.subscription.updated',
            subscriptionObject({ status })
          ),
        })
      ).resolves.toEqual({ handled: true });

      expect(db.sailingCardSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ status: expectedStatus }),
        })
      );
    }
  );

  it('marks deleted subscriptions canceled even when Stripe sends another status', async () => {
    const db = createDb();
    db.sailingCardSubscription.findFirst
      .mockResolvedValueOnce({
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      })
      .mockResolvedValueOnce(null);

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent(
          'customer.subscription.deleted',
          subscriptionObject({ status: 'active' })
        ),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.sailingCardSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: SailingCardSubscriptionStatus.canceled,
        }),
      })
    );
  });

  it('returns unhandled for subscription events without local context', async () => {
    const db = createDb({ payment: null, subscription: null });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent(
          'customer.subscription.updated',
          subscriptionObject({
            customer: null,
            metadata: { domain: 'sailing_card_membership' },
          })
        ),
      })
    ).resolves.toEqual({ handled: false });

    expect(db.sailingCardSubscription.upsert).not.toHaveBeenCalled();
  });

  it('updates subscription status from local subscription context without a payment row', async () => {
    const db = createDb({
      payment: null,
      subscription: {
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      },
    });
    db.sailingCardSubscription.findFirst
      .mockResolvedValueOnce({
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      })
      .mockResolvedValueOnce(null);

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent(
          'customer.subscription.updated',
          subscriptionObject({
            metadata: { domain: 'sailing_card_membership' },
            status: 'past_due',
          })
        ),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.sailingCardSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: SailingCardSubscriptionStatus.past_due,
        }),
      })
    );
    expect(db.payment.updateMany).not.toHaveBeenCalled();
  });

  it('keeps expired membership checkout recoverable when Stripe returns a recovery URL', async () => {
    const db = createDb();

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('checkout.session.expired', {
          after_expiration: {
            recovery: {
              url: 'https://checkout.stripe.com/c/pay/cs_recover',
            },
          },
          id: 'cs_test',
          metadata: membershipMetadata(),
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activeCheckoutKey: null,
        status: PaymentStatus.pending,
        stripeCheckoutSessionExpiresAt: null,
        stripeCheckoutSessionId: 'cs_test',
        stripeCheckoutSessionUrl:
          'https://checkout.stripe.com/c/pay/cs_recover',
      }),
      where: { id: 'payment_1', status: PaymentStatus.checkout_created },
    });
  });

  it('cancels expired membership checkout when Stripe has no recovery URL', async () => {
    const db = createDb();

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('checkout.session.expired', {
          id: 'cs_test',
          metadata: membershipMetadata(),
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        activeCheckoutKey: null,
        status: PaymentStatus.cancelled,
        stripeCheckoutSessionUrl: null,
      }),
      where: { id: 'payment_1', status: PaymentStatus.checkout_created },
    });
  });

  it('ignores expired membership checkout when the local payment is gone', async () => {
    const db = createDb({ payment: null });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('checkout.session.expired', {
          id: 'cs_test',
          metadata: membershipMetadata(),
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.updateMany).not.toHaveBeenCalled();
  });

  it('creates a renewal payment row from a paid renewal invoice', async () => {
    const db = createDb({
      payment: null,
      subscription: {
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      },
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('invoice.paid', paidInvoiceObject()),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountCents: 12_500,
        cardType: SailingCardType.racing,
        cardYear: 2027,
        membershipPaymentKind: MembershipPaymentKind.renewal,
        membershipSubscriptionId: 'local_sub_1',
        purpose: 'membership',
        status: PaymentStatus.paid,
        stripeChargeId: 'ch_invoice',
        stripeInvoiceId: 'in_test',
        stripeReceiptUrl: 'https://pay.stripe.com/invoice/test',
      }),
    });
  });

  it('creates renewal rows from invoice amount due and metadata card year', async () => {
    const db = createDb({
      payment: null,
      subscription: {
        cardType: SailingCardType.team_racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      },
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent(
          'invoice.paid',
          paidInvoiceObject({
            amount_due: 9900,
            amount_paid: undefined,
            currency: undefined,
            lines: { data: [] },
            parent: {
              subscription_details: {
                metadata: membershipMetadata({
                  cardType: SailingCardType.team_racing,
                  cardYear: '2028',
                }),
              },
            },
            subscription: 'sub_test',
          })
        ),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountCents: 9900,
        cardType: SailingCardType.team_racing,
        cardYear: 2028,
        currency: 'usd',
      }),
    });
  });

  it('falls back to current card year when renewal invoices lack period metadata', async () => {
    const db = createDb({
      payment: null,
      subscription: {
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      },
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent(
          'invoice.paid',
          paidInvoiceObject({
            amount_due: undefined,
            amount_paid: 0,
            lines: { data: [] },
            parent: {
              subscription_details: {
                metadata: membershipMetadata({ cardYear: 'not-a-year' }),
              },
            },
            subscription: 'sub_test',
          })
        ),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountCents: 0,
        cardYear: 2026,
      }),
    });
  });

  it('uses parent subscription metadata when renewal invoices omit expanded subscription data', async () => {
    const db = createDb({
      payment: null,
      subscription: {
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      },
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent(
          'invoice.paid',
          paidInvoiceObject({
            parent: {
              subscription_details: {
                metadata: membershipMetadata({ subscription: 'sub_test' }),
              },
            },
            subscription: undefined,
          })
        ),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.sailingCardSubscription.findFirst).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_test' },
    });
    expect(db.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        membershipSubscriptionId: 'local_sub_1',
        stripeSubscriptionId: 'sub_test',
      }),
    });
  });

  it('throws instead of recording a paid renewal invoice with no amount', async () => {
    const db = createDb({
      payment: null,
      subscription: {
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      },
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent(
          'invoice.paid',
          paidInvoiceObject({
            amount_due: undefined,
            amount_paid: undefined,
          })
        ),
      })
    ).rejects.toThrow('Membership invoice is missing amount.');

    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it('ignores invoice events that are not initial or renewal subscription bills', async () => {
    const db = createDb();

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent(
          'invoice.paid',
          paidInvoiceObject({ billing_reason: 'manual' })
        ),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.findFirst).not.toHaveBeenCalled();
    expect(db.payment.updateMany).not.toHaveBeenCalled();
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it('throws when a paid invoice has membership metadata but no local context', async () => {
    const db = createDb({ payment: null, subscription: null });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent(
          'invoice.paid',
          paidInvoiceObject({
            customer: null,
            parent: {
              subscription_details: {
                metadata: { domain: 'sailing_card_membership' },
              },
            },
            subscription: 'sub_test',
          })
        ),
      })
    ).rejects.toThrow('Membership invoice is missing local context.');
  });

  it('uses the local subscription user for renewal invoice rows', async () => {
    const db = createDb({
      payment: null,
      subscription: {
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_from_subscription',
      },
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent(
          'invoice.paid',
          paidInvoiceObject({
            parent: {
              subscription_details: {
                metadata: membershipMetadata({ userId: undefined }),
              },
            },
          })
        ),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stripeInvoiceId: 'in_test',
        userId: 'user_from_subscription',
      }),
    });
  });

  it('throws when a duplicate renewal invoice row cannot be re-read after conflict', async () => {
    const db = createDb({
      payment: null,
      subscription: {
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      },
    });
    db.payment.findFirst.mockResolvedValue(null);
    db.payment.create.mockRejectedValueOnce(stripeInvoiceUniqueError());

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('invoice.paid', paidInvoiceObject()),
      })
    ).rejects.toThrow(
      'Membership renewal invoice row not found after conflict.'
    );

    expect(db.payment.updateMany).not.toHaveBeenCalled();
  });

  it('updates a duplicate renewal invoice when Prisma reports a string target', async () => {
    const db = createDb({
      payment: null,
      subscription: {
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      },
    });
    db.payment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(
      membershipPayment({
        cardYear: 2027,
        membershipPaymentKind: MembershipPaymentKind.renewal,
        status: PaymentStatus.past_due,
        stripeInvoiceId: 'in_test',
      })
    );
    db.payment.create.mockRejectedValueOnce(
      stripeInvoiceUniqueError('stripe_invoice_id')
    );

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('invoice.paid', paidInvoiceObject()),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: PaymentStatus.paid,
        stripeInvoiceId: 'in_test',
      }),
      where: { id: 'payment_1', status: PaymentStatus.past_due },
    });
  });

  it('surfaces non-invoice unique errors while creating renewal rows', async () => {
    const db = createDb({
      payment: null,
      subscription: {
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      },
    });
    db.payment.create.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('invoice.paid', paidInvoiceObject()),
      })
    ).rejects.toThrow('database unavailable');
  });

  it('surfaces unique errors that are not invoice id conflicts', async () => {
    const db = createDb({
      payment: null,
      subscription: {
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      },
    });
    db.payment.create.mockRejectedValueOnce(
      stripeInvoiceUniqueError(['userId'])
    );

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('invoice.paid', paidInvoiceObject()),
      })
    ).rejects.toThrow(
      'Unique constraint failed on the fields: (`stripe_invoice_id`)'
    );
  });

  it('updates a renewal invoice row created by a concurrent delivery', async () => {
    const db = createDb({
      payment: null,
      subscription: {
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      },
    });
    db.payment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(
      membershipPayment({
        cardYear: 2027,
        membershipPaymentKind: MembershipPaymentKind.renewal,
        status: PaymentStatus.past_due,
        stripeInvoiceId: 'in_test',
      })
    );
    db.payment.create.mockRejectedValueOnce(stripeInvoiceUniqueError());

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('invoice.paid', paidInvoiceObject()),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lastStripeInvoiceEventId: 'evt_invoice_paid',
        status: PaymentStatus.paid,
        stripeInvoiceId: 'in_test',
      }),
      where: { id: 'payment_1', status: PaymentStatus.past_due },
    });
  });

  it('does not update the initial checkout row for renewal invoices', async () => {
    const db = createDb({
      payment: null,
      subscription: {
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      },
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent(
          'invoice.payment_succeeded',
          paidInvoiceObject()
        ),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.findFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      where: {
        OR: [{ stripeInvoiceId: 'in_test' }],
        purpose: 'membership',
      },
    });
    expect(db.payment.updateMany).not.toHaveBeenCalled();
    expect(db.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        membershipPaymentKind: MembershipPaymentKind.renewal,
        stripeInvoiceId: 'in_test',
      }),
    });
  });

  it('updates the same invoice row for duplicate renewal invoice deliveries', async () => {
    const db = createDb({
      payment: membershipPayment({
        cardYear: 2027,
        membershipPaymentKind: MembershipPaymentKind.renewal,
        status: PaymentStatus.paid,
        stripeInvoiceId: 'in_test',
      }),
      subscription: {
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      },
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent(
          'invoice.payment_succeeded',
          paidInvoiceObject()
        ),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.create).not.toHaveBeenCalled();
    expect(db.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lastStripeInvoiceEventId: 'evt_invoice_payment_succeeded',
        stripeInvoiceId: 'in_test',
      }),
      where: { id: 'payment_1', status: PaymentStatus.paid },
    });
  });

  it('marks failed invoices past due without inventing unknown local users', async () => {
    const db = createDb();

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('invoice.payment_failed', {
          amount_due: 12_500,
          billing_reason: 'subscription_create',
          currency: 'usd',
          customer: 'cus_test',
          hosted_invoice_url: 'https://pay.stripe.com/invoice/test',
          id: 'in_test',
          invoice_pdf: 'https://pay.stripe.com/invoice/test/pdf',
          parent: { subscription_details: { metadata: membershipMetadata() } },
          subscription: 'sub_test',
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.sailingCardSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.not.objectContaining({ userId: 'unknown' }),
      })
    );
    expect(db.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        issueKind: 'failed_payment',
        status: PaymentStatus.past_due,
        stripeInvoiceId: 'in_test',
      }),
      where: { id: 'payment_1', status: PaymentStatus.checkout_created },
    });
  });

  it('creates a past-due renewal payment row from a failed renewal invoice', async () => {
    const db = createDb({
      payment: null,
      subscription: {
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      },
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent(
          'invoice.payment_failed',
          paidInvoiceObject({
            amount_due: 12_500,
            amount_paid: 0,
            charge: null,
            payment_intent: 'pi_failed',
          })
        ),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardYear: 2027,
        issueKind: 'failed_payment',
        membershipPaymentKind: MembershipPaymentKind.renewal,
        membershipSubscriptionId: 'local_sub_1',
        status: PaymentStatus.past_due,
        stripeInvoiceId: 'in_test',
        userId: 'user_1',
      }),
    });
  });

  it('updates a failed renewal invoice row created by a concurrent delivery', async () => {
    const db = createDb({
      payment: null,
      subscription: {
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      },
    });
    db.payment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(
      membershipPayment({
        cardYear: 2027,
        membershipPaymentKind: MembershipPaymentKind.renewal,
        status: PaymentStatus.pending,
        stripeInvoiceId: 'in_test',
      })
    );
    db.payment.create.mockRejectedValueOnce(stripeInvoiceUniqueError());

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent(
          'invoice.payment_failed',
          paidInvoiceObject({
            amount_due: 12_500,
            amount_paid: 0,
            charge: null,
            payment_intent: 'pi_failed',
          })
        ),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        issueKind: 'failed_payment',
        status: PaymentStatus.past_due,
        stripeInvoiceId: 'in_test',
      }),
      where: { id: 'payment_1', status: PaymentStatus.pending },
    });
  });

  it('does not apply an older failed invoice after a paid invoice', async () => {
    const db = createDb({
      payment: membershipPayment({
        lastStripeInvoiceEventCreatedAt: new Date(
          (stripeEventCreated + 60) * 1000
        ),
        status: PaymentStatus.paid,
        stripeInvoiceId: 'in_test',
      }),
      subscription: {
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      },
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent(
          'invoice.payment_failed',
          paidInvoiceObject({
            amount_due: 12_500,
            amount_paid: 0,
            charge: null,
            payment_intent: 'pi_failed',
          })
        ),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.updateMany).not.toHaveBeenCalled();
  });

  it('does not apply an older paid invoice after a newer invoice event', async () => {
    const db = createDb({
      payment: membershipPayment({
        lastStripeInvoiceEventCreatedAt: new Date(
          (stripeEventCreated + 60) * 1000
        ),
        status: PaymentStatus.past_due,
        stripeInvoiceId: 'in_test',
      }),
      subscription: {
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      },
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('invoice.paid', paidInvoiceObject()),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.updateMany).not.toHaveBeenCalled();
  });

  it('stores charge references from membership charge events for later issue matching', async () => {
    const db = createDb({
      payment: membershipPayment({
        status: PaymentStatus.paid,
        stripePaymentIntentId: 'pi_test',
      }),
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('charge.succeeded', {
          id: 'ch_test',
          metadata: membershipMetadata(),
          payment_intent: 'pi_test',
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lastStripePaymentEventId: 'evt_charge_succeeded',
        stripeChargeId: 'ch_test',
        stripePaymentIntentId: 'pi_test',
      }),
      where: { id: 'payment_1', status: PaymentStatus.paid },
    });
  });

  it('stores charge references without inventing a payment intent id', async () => {
    const db = createDb({
      payment: membershipPayment({
        status: PaymentStatus.paid,
        stripeChargeId: 'ch_test',
      }),
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('charge.succeeded', {
          id: 'ch_test',
          metadata: membershipMetadata(),
          payment_intent: null,
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.updateMany).toHaveBeenCalledWith({
      data: {
        lastStripePaymentEventCreatedAt: new Date(stripeEventCreated * 1000),
        lastStripePaymentEventId: 'evt_charge_succeeded',
        stripeChargeId: 'ch_test',
      },
      where: { id: 'payment_1', status: PaymentStatus.paid },
    });
  });

  it('ignores membership payment reference events without a local payment', async () => {
    const db = createDb({ payment: null });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('payment_intent.succeeded', {
          id: 'pi_missing',
          metadata: membershipMetadata({ localPaymentId: undefined }),
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.updateMany).not.toHaveBeenCalled();
  });

  it('stores payment intent references without inventing a charge id', async () => {
    const db = createDb({
      payment: membershipPayment({
        status: PaymentStatus.checkout_created,
        stripePaymentIntentId: 'pi_test',
      }),
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('payment_intent.succeeded', {
          id: 'pi_test',
          metadata: membershipMetadata(),
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.updateMany).toHaveBeenCalledWith({
      data: {
        lastStripePaymentEventCreatedAt: new Date(stripeEventCreated * 1000),
        lastStripePaymentEventId: 'evt_payment_intent_succeeded',
        stripePaymentIntentId: 'pi_test',
      },
      where: { id: 'payment_1', status: PaymentStatus.checkout_created },
    });
  });

  it('uses cumulative partial refund totals from Stripe charge refunds', async () => {
    const db = createDb({
      payment: membershipPayment({
        status: PaymentStatus.paid,
        stripePaymentIntentId: 'pi_test',
      }),
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('charge.refunded', {
          amount: 12_500,
          amount_refunded: 2500,
          id: 'ch_test',
          payment_intent: 'pi_test',
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ stripePaymentIntentId: 'pi_test' }]),
          purpose: 'membership',
        }),
      })
    );
    expect(db.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        issueKind: 'refunded_current_season',
        refundedAmountCents: 2500,
        status: PaymentStatus.refunded,
        stripeChargeId: 'ch_test',
      }),
      where: { id: 'payment_1', status: PaymentStatus.paid },
    });
    expect(
      db.payment.updateMany.mock.calls.at(-1)?.[0].data
    ).not.toHaveProperty('stripeRefundId');
  });

  it('matches succeeded membership refund updates through the persisted payment intent id', async () => {
    const db = createDb({
      payment: membershipPayment({
        status: PaymentStatus.paid,
        stripePaymentIntentId: 'pi_test',
      }),
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('refund.updated', {
          amount: 1500,
          charge: 'ch_test',
          id: 're_test',
          payment_intent: 'pi_test',
          status: 'succeeded',
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ stripePaymentIntentId: 'pi_test' }]),
          purpose: 'membership',
        }),
      })
    );
    expect(db.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        issueKind: 'refunded_current_season',
        status: PaymentStatus.refunded,
        stripeRefundId: 're_test',
      }),
      where: { id: 'payment_1', status: PaymentStatus.paid },
    });
    expect(
      db.payment.updateMany.mock.calls.at(-1)?.[0].data
    ).not.toHaveProperty('refundedAmountCents');
  });

  it('matches refund updates by payment intent when Stripe omits charge context', async () => {
    const db = createDb({
      payment: membershipPayment({
        status: PaymentStatus.paid,
        stripePaymentIntentId: 'pi_test',
      }),
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('refund.updated', {
          amount: 1500,
          id: 're_test',
          payment_intent: 'pi_test',
          status: 'succeeded',
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        issueKind: 'refunded_current_season',
        status: PaymentStatus.refunded,
        stripeRefundId: 're_test',
      }),
      where: { id: 'payment_1', status: PaymentStatus.paid },
    });
    expect(
      db.payment.updateMany.mock.calls.at(-1)?.[0].data
    ).not.toHaveProperty('stripeChargeId');
  });

  it('does not mark pending refund updates as refunded', async () => {
    const db = createDb({
      payment: membershipPayment({
        status: PaymentStatus.paid,
        stripePaymentIntentId: 'pi_test',
      }),
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('refund.updated', {
          amount: 1500,
          charge: 'ch_test',
          id: 're_test',
          payment_intent: 'pi_test',
          status: 'pending',
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.updateMany).not.toHaveBeenCalled();
  });

  it('matches membership disputes through the persisted payment intent id', async () => {
    const db = createDb({
      payment: membershipPayment({
        status: PaymentStatus.paid,
        stripePaymentIntentId: 'pi_test',
      }),
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('charge.dispute.created', {
          amount: 12_500,
          charge: 'ch_test',
          id: 'dp_test',
          payment_intent: 'pi_test',
          status: 'needs_response',
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ stripePaymentIntentId: 'pi_test' }]),
          purpose: 'membership',
        }),
      })
    );
    expect(db.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        disputeStatus: 'needs_response',
        issueKind: 'disputed_current_season',
        refundedAmountCents: 12_500,
        status: PaymentStatus.disputed,
        stripeDisputeId: 'dp_test',
      }),
      where: { id: 'payment_1', status: PaymentStatus.paid },
    });
  });

  it('does not apply stale membership payment issue events', async () => {
    const db = createDb({
      payment: membershipPayment({
        lastStripePaymentEventCreatedAt: new Date(
          (stripeEventCreated + 60) * 1000
        ),
        status: PaymentStatus.refunded,
        stripePaymentIntentId: 'pi_test',
      }),
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('refund.updated', {
          amount: 1500,
          charge: 'ch_test',
          id: 're_test',
          payment_intent: 'pi_test',
          status: 'succeeded',
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.updateMany).not.toHaveBeenCalled();
  });

  it('reports membership issue events handled when no local payment matches', async () => {
    const db = createDb({ payment: null });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('refund.updated', {
          amount: 1500,
          charge: 'ch_missing',
          id: 're_test',
          metadata: membershipMetadata({ localPaymentId: undefined }),
          status: 'succeeded',
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.updateMany).not.toHaveBeenCalled();
  });

  it('reports non-membership issue events unhandled when no local payment matches', async () => {
    const db = createDb({ payment: null });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('refund.updated', {
          amount: 1500,
          charge: 'ch_missing',
          id: 're_test',
          status: 'succeeded',
        }),
      })
    ).resolves.toEqual({ handled: false });

    expect(db.payment.updateMany).not.toHaveBeenCalled();
  });

  it('does not revert a refunded payment when a late paid invoice arrives', async () => {
    const db = createDb({
      payment: membershipPayment({
        status: PaymentStatus.refunded,
        stripePaymentIntentId: 'pi_test',
      }),
      subscription: {
        cardType: SailingCardType.racing,
        id: 'local_sub_1',
        stripeCustomerId: 'cus_test',
        userId: 'user_1',
      },
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('invoice.paid', {
          amount_paid: 12_500,
          billing_reason: 'subscription_create',
          currency: 'usd',
          customer: 'cus_test',
          hosted_invoice_url: 'https://pay.stripe.com/invoice/test',
          id: 'in_test',
          invoice_pdf: 'https://pay.stripe.com/invoice/test/pdf',
          parent: { subscription_details: { metadata: membershipMetadata() } },
          payment_intent: 'pi_test',
          subscription: subscriptionObject({ status: 'active' }),
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.updateMany).toHaveBeenCalledWith({
      data: expect.not.objectContaining({
        status: PaymentStatus.paid,
      }),
      where: { id: 'payment_1', status: PaymentStatus.refunded },
    });
  });

  it('classifies invoice action-required events without local payment mutation', async () => {
    const db = createDb();

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('invoice.payment_action_required', {
          customer: 'cus_test',
          id: 'in_requires_action',
          parent: { subscription_details: { metadata: membershipMetadata() } },
          subscription: 'sub_test',
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.create).not.toHaveBeenCalled();
    expect(db.payment.updateMany).not.toHaveBeenCalled();
  });

  it('does not revert a refunded payment when a late completed checkout arrives', async () => {
    const db = createDb({
      payment: membershipPayment({
        status: PaymentStatus.refunded,
        stripePaymentIntentId: 'pi_test',
      }),
      subscription: null,
    });

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('checkout.session.completed', {
          customer: 'cus_test',
          id: 'cs_test',
          metadata: membershipMetadata(),
          payment_status: 'paid',
          subscription: subscriptionObject({ status: 'active' }),
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.updateMany).toHaveBeenCalledWith({
      data: expect.not.objectContaining({
        status: PaymentStatus.paid,
      }),
      where: { id: 'payment_1', status: PaymentStatus.refunded },
    });
  });

  it('ignores event payment Stripe objects', async () => {
    const db = createDb();

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('payment_intent.succeeded', {
          id: 'pi_event',
          metadata: { paymentId: 'event_payment_1' },
        }),
      })
    ).resolves.toEqual({ handled: false });

    expect(db.payment.findFirst).not.toHaveBeenCalled();
  });

  it('throws when membership issue events do not have writable db access', async () => {
    const db = createDb();

    await expect(
      handleMembershipStripeWebhookEvent({
        db: withoutPaymentWrites(db),
        event: membershipEvent('refund.updated', {
          amount: 1500,
          charge: 'ch_test',
          id: 're_test',
          metadata: membershipMetadata({ localPaymentId: undefined }),
          status: 'succeeded',
        }),
      })
    ).rejects.toThrow(
      'Membership Stripe webhooks require membership db access.'
    );
  });

  it('throws when membership object events do not have writable db access', async () => {
    const db = createDb();

    await expect(
      handleMembershipStripeWebhookEvent({
        db: withoutPaymentWrites(db),
        event: membershipEvent('invoice.paid', paidInvoiceObject()),
      })
    ).rejects.toThrow(
      'Membership Stripe webhooks require membership db access.'
    );
  });

  it('leaves unknown membership event types unhandled', async () => {
    const db = createDb();

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('customer.created', {
          id: 'cus_test',
          metadata: membershipMetadata(),
        }),
      })
    ).resolves.toEqual({ handled: false });
  });
});
