import { describe, expect, it, vi } from 'vitest';
import {
  PaymentPurpose,
  PaymentSource,
  PaymentStatus,
  SailingAffiliation,
  SailingCardMembershipBillingInterval,
  SailingCardMembershipPriceCategory,
  SailingCardMembershipPriceKind,
  SailingCardType,
} from '@/generated/prisma/enums';
import { createMembershipCheckoutForOnboarding } from '@/libs/mit-sailing/membershipBilling/membershipCheckoutActions';

vi.mock('server-only', () => ({}));

const dueTodayPrice = {
  active: true,
  amountCents: 7000,
  billingInterval: SailingCardMembershipBillingInterval.one_time,
  cardType: SailingCardType.racing,
  currency: 'usd',
  effectiveAt: new Date('2026-01-01T00:00:00.000Z'),
  id: 'price_initial',
  priceCategory: SailingCardMembershipPriceCategory.under_30,
  priceKind: SailingCardMembershipPriceKind.spring,
  stripePriceId: 'price_stripe_initial',
  stripeSyncError: null,
  stripeSyncedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const renewalPrice = {
  ...dueTodayPrice,
  amountCents: 12_500,
  billingInterval: SailingCardMembershipBillingInterval.annual,
  id: 'price_renewal',
  priceKind: SailingCardMembershipPriceKind.full,
  stripePriceId: 'price_stripe_renewal',
};

describe('membershipCheckoutActions', () => {
  it('creates one pending membership payment and a hosted Stripe Checkout URL from onboarding', async () => {
    const paymentCreate = vi.fn().mockResolvedValue({
      activeCheckoutKey:
        'membership:user_1:2026:racing:price_initial:price_renewal',
      cardType: SailingCardType.racing,
      cardYear: 2026,
      id: 'payment_1',
      userId: 'user_1',
    });
    const checkoutCreate = vi.fn().mockResolvedValue({
      customer: 'cus_test',
      expires_at: 1_780_000_000,
      id: 'cs_test',
      url: 'https://checkout.stripe.com/c/pay/cs_test',
    });

    const result = await createMembershipCheckoutForOnboarding({
      cancelUrl: 'https://sailing.mit.edu/onboarding?checkout=cancelled',
      cardType: SailingCardType.racing,
      client: {
        payment: {
          create: paymentCreate,
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
        },
        sailingCardSubscription: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      dueTodayPrice,
      now: new Date('2026-05-31T12:00:00.000Z'),
      renewalPrice,
      stripe: {
        checkout: { sessions: { create: checkoutCreate } },
        customers: {
          create: vi.fn(),
          search: vi.fn().mockResolvedValue({ data: [{ id: 'cus_test' }] }),
        },
      },
      successUrl:
        'https://sailing.mit.edu/onboarding/success?session_id={CHECKOUT_SESSION_ID}',
      user: {
        dateOfBirth: '1998-01-01',
        email: 'member@example.com',
        id: 'user_1',
        name: 'Member Example',
        sailingAffiliation: SailingAffiliation.OTHER_NON_STUDENT,
      },
    });

    expect(result).toEqual({
      status: 'created',
      url: 'https://checkout.stripe.com/c/pay/cs_test',
    });
    expect(paymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountCents: 7000,
          cardType: SailingCardType.racing,
          membershipConsentSnapshot: expect.objectContaining({
            autoRenewDisclosureKey: 'membership_checkout_auto_renew_disclosure',
            paymentMethodDisclosureKey:
              'membership_checkout_wallet_payment_disclosure',
          }),
          membershipPaymentKind: 'initial',
          purpose: PaymentPurpose.membership,
          source: PaymentSource.stripe,
          status: PaymentStatus.pending,
          stripeCustomerId: 'cus_test',
        }),
      })
    );
  });

  it('reuses a non-expired pending hosted checkout payment', async () => {
    const result = await createMembershipCheckoutForOnboarding({
      cancelUrl: 'https://sailing.mit.edu/onboarding?checkout=cancelled',
      cardType: SailingCardType.racing,
      client: {
        payment: {
          create: vi.fn(),
          findFirst: vi.fn().mockResolvedValue({
            stripeCheckoutSessionExpiresAt: new Date(
              '2026-05-31T13:00:00.000Z'
            ),
            stripeCheckoutSessionUrl:
              'https://checkout.stripe.com/c/pay/cs_existing',
          }),
          update: vi.fn(),
        },
        sailingCardSubscription: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      dueTodayPrice,
      now: new Date('2026-05-31T12:00:00.000Z'),
      renewalPrice,
      stripe: {
        checkout: { sessions: { create: vi.fn() } },
        customers: {
          create: vi.fn(),
          search: vi.fn(),
        },
      },
      successUrl:
        'https://sailing.mit.edu/onboarding/success?session_id={CHECKOUT_SESSION_ID}',
      user: {
        dateOfBirth: '1998-01-01',
        email: 'member@example.com',
        id: 'user_1',
        name: 'Member Example',
        sailingAffiliation: SailingAffiliation.OTHER_NON_STUDENT,
      },
    });

    expect(result).toEqual({
      status: 'created',
      url: 'https://checkout.stripe.com/c/pay/cs_existing',
    });
  });
});
