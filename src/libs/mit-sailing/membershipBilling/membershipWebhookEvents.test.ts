import { describe, expect, it, vi } from 'vitest';
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

  it('creates a renewal payment row from a paid invoice without splitting ledgers', async () => {
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
        event: membershipEvent('invoice.paid', {
          amount_paid: 12_500,
          billing_reason: 'subscription_cycle',
          currency: 'usd',
          customer: 'cus_test',
          charge: 'ch_invoice',
          hosted_invoice_url: 'https://pay.stripe.com/invoice/test',
          id: 'in_test',
          invoice_pdf: 'https://pay.stripe.com/invoice/test/pdf',
          lines: { data: [{ period: { start: 1_784_088_000 } }] },
          parent: { subscription_details: { metadata: membershipMetadata() } },
          payment_intent: 'pi_test',
          subscription: subscriptionObject({ status: 'active' }),
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.findFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      where: {
        OR: [{ stripeInvoiceId: 'in_test' }],
        purpose: 'membership',
      },
    });
    expect(db.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountCents: 12_500,
        cardYear: 2027,
        membershipPaymentKind: MembershipPaymentKind.renewal,
        membershipSubscriptionId: 'local_sub_1',
        purpose: 'membership',
        registrationId: null,
        status: PaymentStatus.paid,
        stripeChargeId: 'ch_invoice',
        stripeInvoiceId: 'in_test',
        stripeReceiptUrl: 'https://pay.stripe.com/invoice/test',
      }),
    });
  });

  it('marks failed invoices past due without inventing unknown local users', async () => {
    const db = createDb();

    await expect(
      handleMembershipStripeWebhookEvent({
        db,
        event: membershipEvent('invoice.payment_failed', {
          amount_due: 12_500,
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

  it('does not mark the initial payment past due for renewal invoice failures', async () => {
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
        event: membershipEvent('invoice.payment_failed', {
          amount_due: 12_500,
          billing_reason: 'subscription_cycle',
          currency: 'usd',
          customer: 'cus_test',
          hosted_invoice_url: 'https://pay.stripe.com/invoice/test',
          id: 'in_renewal_failed',
          invoice_pdf: 'https://pay.stripe.com/invoice/test/pdf',
          parent: { subscription_details: { metadata: membershipMetadata() } },
          subscription: 'sub_test',
        }),
      })
    ).resolves.toEqual({ handled: true });

    expect(db.payment.findFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      where: {
        OR: [{ stripeInvoiceId: 'in_renewal_failed' }],
        purpose: 'membership',
      },
    });
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
});
