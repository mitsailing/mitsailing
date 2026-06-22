import { describe, expect, it, vi } from 'vitest';
import {
  SailingCardMembershipBillingInterval,
  SailingCardMembershipPriceCategory,
  SailingCardMembershipPriceKind,
  SailingCardType,
} from '@/generated/prisma/enums';
import { createStripeMembershipCheckoutSession } from '@/libs/mit-sailing/membershipBilling/membershipStripeCheckout';

vi.mock('server-only', () => ({}));

const checkoutPrice = {
  active: true,
  amountCents: 7000,
  billingInterval: SailingCardMembershipBillingInterval.one_time,
  cardType: SailingCardType.racing,
  currency: 'usd',
  effectiveAt: new Date('2026-01-01T00:00:00.000Z'),
  id: 'price_local_spring',
  priceCategory: SailingCardMembershipPriceCategory.under_30,
  priceKind: SailingCardMembershipPriceKind.spring,
  stripePriceId: 'price_spring',
  stripeSyncError: null,
  stripeSyncedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const checkoutPayment = {
  activeCheckoutKey: 'membership:user_1:2026:racing:price_local_spring',
  cardType: SailingCardType.racing,
  cardYear: 2026,
  id: 'payment_1',
  userId: 'user_1',
};

describe('membershipStripeCheckout', () => {
  it('creates a hosted one-time Checkout session with promotion codes', async () => {
    const create = vi.fn().mockResolvedValue({
      customer: 'cus_test',
      expires_at: 1_780_000_000,
      id: 'cs_test',
      url: 'https://checkout.stripe.com/c/pay/cs_test',
    });

    const result = await createStripeMembershipCheckoutSession({
      cancelUrl: 'https://sailing.mit.edu/onboarding?checkout=cancelled',
      customerId: 'cus_test',
      initialPrice: checkoutPrice,
      payment: checkoutPayment,
      stripe: { checkout: { sessions: { create } } },
      successUrl:
        'https://sailing.mit.edu/onboarding/success?session_id={CHECKOUT_SESSION_ID}',
    });

    expect(result).toEqual({
      checkoutSessionId: 'cs_test',
      customerId: 'cus_test',
      expiresAt: new Date(1_780_000_000_000),
      status: 'created',
      url: 'https://checkout.stripe.com/c/pay/cs_test',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        allow_promotion_codes: true,
        cancel_url: 'https://sailing.mit.edu/onboarding?checkout=cancelled',
        client_reference_id: 'payment_1',
        customer: 'cus_test',
        line_items: [{ price: 'price_spring', quantity: 1 }],
        mode: 'payment',
        payment_intent_data: expect.objectContaining({
          setup_future_usage: 'off_session',
        }),
        success_url:
          'https://sailing.mit.edu/onboarding/success?session_id={CHECKOUT_SESSION_ID}',
      }),
      { idempotencyKey: 'membership-checkout-payment_1' }
    );
    const params = create.mock.calls[0]?.[0];
    expect(params).not.toHaveProperty('payment_method_types');
    expect(params).not.toHaveProperty('subscription_data');
    expect(params.metadata).toMatchObject({
      domain: 'sailing_card_membership',
      initialMembershipPriceId: 'price_local_spring',
      localPaymentId: 'payment_1',
      userId: 'user_1',
    });
    expect(params.payment_intent_data.metadata).toMatchObject(params.metadata);
  });

  it('fails closed when Stripe does not return a Checkout URL', async () => {
    await expect(
      createStripeMembershipCheckoutSession({
        cancelUrl: 'https://sailing.mit.edu/onboarding?checkout=cancelled',
        customerId: 'cus_test',
        initialPrice: checkoutPrice,
        payment: checkoutPayment,
        stripe: {
          checkout: {
            sessions: {
              create: vi.fn().mockResolvedValue({
                customer: 'cus_test',
                expires_at: 1_780_000_000,
                id: 'cs_test',
                url: null,
              }),
            },
          },
        },
        successUrl:
          'https://sailing.mit.edu/onboarding/success?session_id={CHECKOUT_SESSION_ID}',
      })
    ).rejects.toThrow('Stripe did not return a membership Checkout URL.');
  });
});
