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

vi.mock('@/libs/DB', () => ({
  prisma: {},
}));

vi.mock('@/libs/mit-sailing/membershipBilling/membershipPricing', () => ({
  getCheckoutMembershipPrices: vi.fn(),
}));

vi.mock('@/libs/stripe/stripeClient', () => ({
  getStripeClient: vi.fn(),
}));

type MembershipCheckoutOptions = Parameters<
  typeof createMembershipCheckoutForOnboarding
>[0];
type MembershipCheckoutCreate =
  MembershipCheckoutOptions['stripe']['checkout']['sessions']['create'];
type MembershipPaymentCreate =
  MembershipCheckoutOptions['client']['payment']['create'];
type MembershipPaymentUpdate =
  MembershipCheckoutOptions['client']['payment']['update'];

type CheckoutPaymentLookupArgs = {
  readonly select: {
    readonly id: true;
    readonly stripeCheckoutSessionExpiresAt: true;
    readonly stripeCheckoutSessionUrl: true;
  };
  readonly where: Record<string, unknown>;
};

type CheckoutPaymentLookupResult = {
  readonly id: string;
  readonly stripeCheckoutSessionExpiresAt: Date | null;
  readonly stripeCheckoutSessionUrl: string | null;
};

type CustomerPaymentLookupArgs = {
  readonly orderBy: { readonly updatedAt: 'desc' };
  readonly select: { readonly stripeCustomerId: true };
  readonly where: {
    readonly stripeCustomerId: { readonly not: null };
    readonly userId: string;
  };
};

type CustomerPaymentLookupResult = {
  readonly stripeCustomerId: string | null;
};

type PaymentFindFirst = {
  (
    args: CheckoutPaymentLookupArgs
  ): Promise<CheckoutPaymentLookupResult | null>;
  (
    args: CustomerPaymentLookupArgs
  ): Promise<CustomerPaymentLookupResult | null>;
};

type PaymentFindFirstResult =
  | CheckoutPaymentLookupResult
  | CustomerPaymentLookupResult
  | null;

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

const checkoutUser = {
  dateOfBirth: '1998-01-01',
  email: 'member@example.com',
  id: 'user_1',
  name: 'Member Example',
  sailingAffiliation: SailingAffiliation.OTHER_NON_STUDENT,
};

function paymentFindFirstMock(
  ...results: PaymentFindFirstResult[]
): PaymentFindFirst {
  let index = 0;

  function findFirst(
    args: CheckoutPaymentLookupArgs
  ): Promise<CheckoutPaymentLookupResult | null>;
  function findFirst(
    args: CustomerPaymentLookupArgs
  ): Promise<CustomerPaymentLookupResult | null>;
  async function findFirst(
    _args: CheckoutPaymentLookupArgs | CustomerPaymentLookupArgs
  ): Promise<PaymentFindFirstResult> {
    const result = results[index] ?? null;
    index += 1;
    const resolved = await Promise.resolve(result);
    return resolved;
  }

  return findFirst;
}

function checkoutOptions(overrides: {
  readonly checkoutCreate?: MembershipCheckoutCreate;
  readonly paymentCreate?: MembershipPaymentCreate;
  readonly paymentFindFirst?: PaymentFindFirst;
  readonly paymentUpdate?: MembershipPaymentUpdate;
}): MembershipCheckoutOptions {
  return {
    cancelUrl: 'https://sailing.mit.edu/onboarding?checkout=cancelled',
    cardType: SailingCardType.racing,
    client: {
      payment: {
        create:
          overrides.paymentCreate ??
          vi.fn<MembershipPaymentCreate>().mockResolvedValue({
            activeCheckoutKey: 'membership:user_1:2026:racing:price_initial',
            cardType: SailingCardType.racing,
            cardYear: 2026,
            id: 'payment_1',
            userId: 'user_1',
          }),
        findFirst: overrides.paymentFindFirst ?? paymentFindFirstMock(null),
        update: overrides.paymentUpdate ?? vi.fn<MembershipPaymentUpdate>(),
      },
    },
    dueTodayPrice,
    now: new Date('2026-05-31T12:00:00.000Z'),
    stripe: {
      checkout: {
        sessions: {
          create:
            overrides.checkoutCreate ??
            vi.fn<MembershipCheckoutCreate>().mockResolvedValue({
              customer: 'cus_test',
              expires_at: 1_780_000_000,
              id: 'cs_test',
              url: 'https://checkout.stripe.com/c/pay/cs_test',
            }),
        },
      },
      customers: {
        create: vi.fn(),
        search: vi.fn().mockResolvedValue({ data: [{ id: 'cus_test' }] }),
      },
    },
    successUrl:
      'https://sailing.mit.edu/onboarding/success?session_id={CHECKOUT_SESSION_ID}',
    user: checkoutUser,
  };
}

describe('membershipCheckoutActions', () => {
  it('creates one pending membership payment and a hosted Stripe Checkout URL from onboarding', async () => {
    const paymentCreate = vi.fn<MembershipPaymentCreate>().mockResolvedValue({
      activeCheckoutKey: 'membership:user_1:2026:racing:price_initial',
      cardType: SailingCardType.racing,
      cardYear: 2026,
      id: 'payment_1',
      userId: 'user_1',
    });
    const checkoutCreate = vi.fn<MembershipCheckoutCreate>().mockResolvedValue({
      customer: 'cus_test',
      expires_at: 1_780_000_000,
      id: 'cs_test',
      url: 'https://checkout.stripe.com/c/pay/cs_test',
    });

    const result = await createMembershipCheckoutForOnboarding(
      checkoutOptions({ checkoutCreate, paymentCreate })
    );

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
            amountDueTodayCents: 7000,
            paymentMethodDisclosureKey:
              'membership_checkout_wallet_payment_disclosure',
            termsVersion: '2026-06-06-payment-only',
          }),
          membershipInitialPriceId: 'price_initial',
          purpose: PaymentPurpose.membership,
          source: PaymentSource.stripe,
          status: PaymentStatus.pending,
          stripeCustomerId: 'cus_test',
        }),
      })
    );
    expect(paymentCreate.mock.calls[0]?.[0].data).not.toHaveProperty(
      'membershipPaymentKind'
    );
    expect(checkoutCreate).toHaveBeenCalledTimes(1);
  });

  it('reuses a non-expired pending hosted checkout payment', async () => {
    const checkoutCreate = vi.fn<MembershipCheckoutCreate>();

    const result = await createMembershipCheckoutForOnboarding(
      checkoutOptions({
        checkoutCreate,
        paymentFindFirst: paymentFindFirstMock({
          id: 'payment_existing',
          stripeCheckoutSessionExpiresAt: new Date('2026-05-31T13:00:00.000Z'),
          stripeCheckoutSessionUrl:
            'https://checkout.stripe.com/c/pay/cs_existing',
        }),
      })
    );

    expect(result).toEqual({
      status: 'created',
      url: 'https://checkout.stripe.com/c/pay/cs_existing',
    });
    expect(checkoutCreate).not.toHaveBeenCalled();
  });

  it('expires a stale checkout reservation before creating a new Checkout session', async () => {
    const paymentUpdate = vi.fn<MembershipPaymentUpdate>();
    await createMembershipCheckoutForOnboarding(
      checkoutOptions({
        paymentFindFirst: paymentFindFirstMock(
          {
            id: 'payment_existing',
            stripeCheckoutSessionExpiresAt: new Date(
              '2026-05-31T11:00:00.000Z'
            ),
            stripeCheckoutSessionUrl:
              'https://checkout.stripe.com/c/pay/cs_existing',
          },
          null
        ),
        paymentUpdate,
      })
    );

    expect(paymentUpdate).toHaveBeenCalledWith({
      data: {
        activeCheckoutKey: null,
        status: PaymentStatus.past_due,
      },
      where: { id: 'payment_existing' },
    });
  });

  it('clears checkout reservation when Stripe session creation fails', async () => {
    const paymentUpdate = vi.fn<MembershipPaymentUpdate>();

    await expect(
      createMembershipCheckoutForOnboarding(
        checkoutOptions({
          checkoutCreate: vi
            .fn<MembershipCheckoutCreate>()
            .mockRejectedValue(new Error('Stripe unavailable')),
          paymentUpdate,
        })
      )
    ).rejects.toThrow('Stripe unavailable');

    expect(paymentUpdate).toHaveBeenCalledWith({
      data: {
        activeCheckoutKey: null,
        status: PaymentStatus.cancelled,
      },
      where: { id: 'payment_1' },
    });
  });

  it('clears checkout reservation when local session persistence fails', async () => {
    const paymentUpdate = vi
      .fn<MembershipPaymentUpdate>()
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({});

    await expect(
      createMembershipCheckoutForOnboarding(checkoutOptions({ paymentUpdate }))
    ).rejects.toThrow('database unavailable');

    expect(paymentUpdate).toHaveBeenNthCalledWith(2, {
      data: {
        activeCheckoutKey: null,
        status: PaymentStatus.cancelled,
      },
      where: { id: 'payment_1' },
    });
  });
});
