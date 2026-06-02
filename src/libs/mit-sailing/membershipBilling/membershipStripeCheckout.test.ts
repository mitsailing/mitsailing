import { describe, expect, it, vi } from 'vitest';
import {
  SailingCardMembershipBillingInterval,
  SailingCardMembershipPriceCategory,
  SailingCardMembershipPriceKind,
  SailingCardType,
} from '@/generated/prisma/enums';
import {
  createStripeMembershipCheckoutSession,
  membershipCheckoutAvailability,
} from '@/libs/mit-sailing/membershipBilling/membershipStripeCheckout';

vi.mock('server-only', () => ({}));

const price = (overrides: {
  readonly billingInterval: SailingCardMembershipBillingInterval;
  readonly id: string;
  readonly priceKind: SailingCardMembershipPriceKind;
  readonly stripePriceId: string;
}) => ({
  active: true,
  amountCents:
    overrides.billingInterval === SailingCardMembershipBillingInterval.annual
      ? 12_500
      : 7000,
  billingInterval: overrides.billingInterval,
  cardType: SailingCardType.racing,
  currency: 'usd',
  effectiveAt: new Date('2026-01-01T00:00:00.000Z'),
  id: overrides.id,
  priceCategory: SailingCardMembershipPriceCategory.under_30,
  priceKind: overrides.priceKind,
  stripePriceId: overrides.stripePriceId,
  stripeSyncError: null,
  stripeSyncedAt: new Date('2026-01-01T00:00:00.000Z'),
});

const springPrice = price({
  billingInterval: SailingCardMembershipBillingInterval.one_time,
  id: 'price_local_spring',
  priceKind: SailingCardMembershipPriceKind.spring,
  stripePriceId: 'price_spring',
});

const annualPrice = price({
  billingInterval: SailingCardMembershipBillingInterval.annual,
  id: 'price_local_annual',
  priceKind: SailingCardMembershipPriceKind.full,
  stripePriceId: 'price_annual',
});

const checkoutPayment = {
  activeCheckoutKey:
    'membership:user_1:racing:2026:price_local_spring:price_local_annual',
  cardType: SailingCardType.racing,
  cardYear: 2026,
  id: 'payment_1',
  userId: 'user_1',
};

describe('membershipStripeCheckout', () => {
  it('creates a hosted subscription Checkout session with one-time today and annual renewal prices', async () => {
    const create = vi.fn().mockResolvedValue({
      customer: 'cus_test',
      expires_at: 1_780_000_000,
      id: 'cs_test',
      url: 'https://checkout.stripe.com/c/pay/cs_test',
    });

    const result = await createStripeMembershipCheckoutSession({
      cancelUrl: 'https://sailing.mit.edu/onboarding?checkout=cancelled',
      customerId: 'cus_test',
      initialPrice: springPrice,
      now: new Date('2026-05-31T12:00:00.000Z'),
      payment: checkoutPayment,
      renewalPrice: annualPrice,
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
        cancel_url: 'https://sailing.mit.edu/onboarding?checkout=cancelled',
        client_reference_id: 'payment_1',
        customer: 'cus_test',
        line_items: [
          { price: 'price_annual', quantity: 1 },
          { price: 'price_spring', quantity: 1 },
        ],
        mode: 'subscription',
        after_expiration: {
          recovery: { enabled: true },
        },
        success_url:
          'https://sailing.mit.edu/onboarding/success?session_id={CHECKOUT_SESSION_ID}',
        subscription_data: expect.objectContaining({
          billing_cycle_anchor: 1_784_088_000,
          proration_behavior: 'none',
        }),
      }),
      { idempotencyKey: 'membership-checkout-payment_1' }
    );
    const params = create.mock.calls[0]?.[0];
    expect(params).not.toHaveProperty('return_url');
    expect(params.subscription_data).not.toHaveProperty('trial_end');
    expect(params.metadata).toMatchObject({
      domain: 'sailing_card_membership',
      initialMembershipPriceId: 'price_local_spring',
      localPaymentId: 'payment_1',
      renewalMembershipPriceId: 'price_local_annual',
      userId: 'user_1',
    });
    expect(params.subscription_data.metadata).toMatchObject(params.metadata);
  });

  it('blocks checkout inside the final 48 hours before July 15 rollover', () => {
    expect(
      membershipCheckoutAvailability(new Date('2026-07-13T03:59:59.000Z'))
    ).toBe('available');
    expect(
      membershipCheckoutAvailability(new Date('2026-07-13T04:00:00.000Z'))
    ).toBe('rollover_blocked');
    expect(
      membershipCheckoutAvailability(new Date('2026-07-15T04:00:00.000Z'))
    ).toBe('available');
  });

  it('uses the following July 15 as the renewal billing anchor after rollover', async () => {
    const create = vi.fn().mockResolvedValue({
      customer: 'cus_test',
      expires_at: 1_780_000_000,
      id: 'cs_test',
      url: 'https://checkout.stripe.com/c/pay/cs_test',
    });

    await createStripeMembershipCheckoutSession({
      cancelUrl: 'https://sailing.mit.edu/onboarding?checkout=cancelled',
      customerId: 'cus_test',
      initialPrice: {
        ...springPrice,
        id: 'price_local_full_initial',
        stripePriceId: 'price_full_initial',
      },
      now: new Date('2026-07-15T04:00:00.000Z'),
      payment: checkoutPayment,
      renewalPrice: annualPrice,
      stripe: { checkout: { sessions: { create } } },
      successUrl:
        'https://sailing.mit.edu/onboarding/success?session_id={CHECKOUT_SESSION_ID}',
    });

    expect(
      create.mock.calls[0]?.[0].subscription_data.billing_cycle_anchor
    ).toBe(1_815_624_000);
  });
});
