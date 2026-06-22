import { describe, expect, it, vi } from 'vitest';
import { PaymentStatus } from '@/generated/prisma/enums';
import type { PaymentStatus as PaymentStatusValue } from '@/generated/prisma/enums';
import { handleMembershipStripeWebhookEvent } from '@/libs/mit-sailing/membershipBilling/membershipWebhookEvents';
import type {
  ProcessableStripeEvent,
  StripeWebhookDb,
} from '@/libs/stripe/stripeWebhookEvents';

vi.mock('server-only', () => ({}));

function stripeEvent(
  type: string,
  object: Record<string, unknown>
): ProcessableStripeEvent {
  return {
    created: 1_780_000_000,
    data: { object },
    id: `evt_${type}`,
    type,
  };
}

function membershipPayment(status: PaymentStatusValue = PaymentStatus.pending) {
  return {
    amountCents: 7000,
    currency: 'usd',
    id: 'payment_1',
    status,
  };
}

function db(payment = membershipPayment()) {
  return {
    eventPaymentNotification: {
      upsert: vi.fn(),
    },
    payment: {
      findFirst: vi.fn().mockResolvedValue(payment),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    stripeWebhookEvent: {
      createMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  } satisfies StripeWebhookDb;
}

function checkoutSession(overrides: Record<string, unknown> = {}) {
  return {
    amount_subtotal: 7000,
    amount_total: 7000,
    client_reference_id: 'payment_1',
    currency: 'usd',
    customer: 'cus_test',
    id: 'cs_test',
    metadata: {
      domain: 'sailing_card_membership',
      localPaymentId: 'payment_1',
    },
    payment_intent: 'pi_test',
    payment_status: 'paid',
    ...overrides,
  };
}

describe('handleMembershipStripeWebhookEvent', () => {
  it('marks paid membership Checkout sessions as paid', async () => {
    const database = db();

    await expect(
      handleMembershipStripeWebhookEvent({
        db: database,
        event: stripeEvent('checkout.session.completed', checkoutSession()),
      })
    ).resolves.toEqual({ handled: true });

    expect(database.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountPaidCents: 7000,
        lastStripePaymentEventId: 'evt_checkout.session.completed',
        status: PaymentStatus.paid,
        stripeCheckoutSessionId: 'cs_test',
        stripeCustomerId: 'cus_test',
        stripePaymentIntentId: 'pi_test',
      }),
      where: { id: 'payment_1', status: PaymentStatus.pending },
    });
  });

  it('accepts 100 percent coupon Checkout sessions without a PaymentIntent', async () => {
    const database = db();

    await handleMembershipStripeWebhookEvent({
      db: database,
      event: stripeEvent(
        'checkout.session.completed',
        checkoutSession({
          amount_total: 0,
          payment_intent: null,
          payment_status: 'no_payment_required',
          total_details: {
            amount_discount: 7000,
            breakdown: {
              discounts: [
                {
                  amount: 7000,
                  discount: {
                    coupon: { id: 'coupon_test', name: 'Volunteer comp' },
                    promotion_code: {
                      code: 'VOLUNTEER',
                      id: 'promo_test',
                    },
                  },
                },
              ],
            },
          },
        })
      ),
    });

    expect(database.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountPaidCents: 0,
        status: PaymentStatus.paid,
        stripeDiscountMetadata: expect.objectContaining({
          amountDiscountCents: 7000,
          discounts: [
            expect.objectContaining({
              couponId: 'coupon_test',
              couponName: 'Volunteer comp',
              promotionCode: 'VOLUNTEER',
              promotionCodeId: 'promo_test',
            }),
          ],
        }),
      }),
      where: { id: 'payment_1', status: PaymentStatus.pending },
    });
  });

  it('marks expired checkout sessions past due', async () => {
    const database = db(membershipPayment(PaymentStatus.checkout_created));

    await handleMembershipStripeWebhookEvent({
      db: database,
      event: stripeEvent('checkout.session.expired', checkoutSession()),
    });

    expect(database.payment.updateMany).toHaveBeenCalledWith({
      data: {
        activeCheckoutKey: null,
        status: PaymentStatus.past_due,
      },
      where: { id: 'payment_1', status: PaymentStatus.checkout_created },
    });
  });

  it('records PaymentIntent ids for succeeded payment intents', async () => {
    const database = db();

    await handleMembershipStripeWebhookEvent({
      db: database,
      event: stripeEvent('payment_intent.succeeded', {
        amount_received: 7000,
        currency: 'usd',
        id: 'pi_test',
        latest_charge: 'ch_test',
        metadata: {
          domain: 'sailing_card_membership',
          localPaymentId: 'payment_1',
        },
      }),
    });

    expect(database.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stripeChargeId: 'ch_test',
        stripePaymentIntentId: 'pi_test',
      }),
      where: { id: 'payment_1', status: PaymentStatus.pending },
    });
  });

  it('records Stripe receipt URLs from succeeded charges', async () => {
    const database = db();

    await handleMembershipStripeWebhookEvent({
      db: database,
      event: stripeEvent('charge.succeeded', {
        amount: 7000,
        currency: 'usd',
        id: 'ch_test',
        metadata: {
          domain: 'sailing_card_membership',
          localPaymentId: 'payment_1',
        },
        payment_intent: 'pi_test',
        receipt_url: 'https://pay.stripe.com/receipts/test',
      }),
    });

    expect(database.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stripeChargeId: 'ch_test',
        stripePaymentIntentId: 'pi_test',
        stripeReceiptUrl: 'https://pay.stripe.com/receipts/test',
      }),
      where: { id: 'payment_1', status: PaymentStatus.pending },
    });
  });

  it('marks refund and dispute events terminal', async () => {
    const refundDb = db(membershipPayment(PaymentStatus.paid));
    await handleMembershipStripeWebhookEvent({
      db: refundDb,
      event: stripeEvent('refund.created', {
        charge: 'ch_test',
        metadata: { domain: 'sailing_card_membership' },
        payment_intent: 'pi_test',
      }),
    });
    expect(refundDb.payment.updateMany).toHaveBeenCalledWith({
      data: {
        status: PaymentStatus.refunded,
        stripeChargeId: 'ch_test',
        stripePaymentIntentId: 'pi_test',
      },
      where: { id: 'payment_1', status: PaymentStatus.paid },
    });

    const disputeDb = db(membershipPayment(PaymentStatus.paid));
    await handleMembershipStripeWebhookEvent({
      db: disputeDb,
      event: stripeEvent('charge.dispute.created', {
        charge: 'ch_test',
        metadata: { domain: 'sailing_card_membership' },
        payment_intent: 'pi_test',
      }),
    });
    expect(disputeDb.payment.updateMany).toHaveBeenCalledWith({
      data: {
        status: PaymentStatus.disputed,
        stripeChargeId: 'ch_test',
        stripePaymentIntentId: 'pi_test',
      },
      where: { id: 'payment_1', status: PaymentStatus.paid },
    });
  });
});
