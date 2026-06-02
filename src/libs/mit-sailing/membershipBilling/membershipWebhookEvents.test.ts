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
      create: vi.fn(),
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

    expect(db.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountCents: 12_500,
        membershipPaymentKind: MembershipPaymentKind.renewal,
        membershipSubscriptionId: 'local_sub_1',
        purpose: 'membership',
        status: PaymentStatus.paid,
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
