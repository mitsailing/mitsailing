import { createHash } from 'node:crypto';
import type { Stripe } from 'stripe';
import {
  PaymentPurpose,
  PaymentSource,
  PaymentStatus,
} from '@/generated/prisma/enums';
import type {
  SailingAffiliation,
  SailingCardType,
} from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import type { SailingCardMembershipPriceRow } from '@/libs/mit-sailing/membershipBilling/membershipPricing';
import { getCheckoutMembershipPrices } from '@/libs/mit-sailing/membershipBilling/membershipPricing';
import { createStripeMembershipCheckoutSession } from '@/libs/mit-sailing/membershipBilling/membershipStripeCheckout';
import { getOrCreateMembershipStripeCustomer } from '@/libs/mit-sailing/membershipBilling/membershipStripeCustomers';
import type { MembershipStripeCustomerClient } from '@/libs/mit-sailing/membershipBilling/membershipStripeCustomers';
import {
  canRequestPaidRacingMembership,
  membershipAccessForOnboardingFlags,
} from '@/libs/mit-sailing/sailingCardMembershipEligibility';
import { getCurrentSailingCardYear } from '@/libs/mit-sailing/sailingCardValidity';
import { getStripeClient } from '@/libs/stripe/stripeClient';

type MembershipCheckoutUser = {
  readonly dateOfBirth: string;
  readonly email: string;
  readonly id: string;
  readonly name: string | null;
  readonly sailingAffiliation: SailingAffiliation;
};

type MembershipCheckoutClient = MembershipStripeCustomerClient & {
  readonly payment: {
    readonly findFirst: MembershipStripeCustomerClient['payment']['findFirst'] &
      ((args: {
        readonly select: {
          readonly id: true;
          readonly stripeCheckoutSessionExpiresAt: true;
          readonly stripeCheckoutSessionUrl: true;
        };
        readonly where: Record<string, unknown>;
      }) => Promise<{
        readonly id: string;
        readonly stripeCheckoutSessionExpiresAt: Date | null;
        readonly stripeCheckoutSessionUrl: string | null;
      } | null>);
    create(args: { readonly data: Record<string, unknown> }): Promise<{
      readonly activeCheckoutKey: string | null;
      readonly cardType: SailingCardType | null;
      readonly cardYear: number | null;
      readonly id: string;
      readonly userId: string | null;
    }>;
    update(args: {
      readonly data: Record<string, unknown>;
      readonly where: { readonly id: string };
    }): Promise<unknown>;
  };
};

type MembershipCheckoutStripe = {
  readonly checkout: {
    readonly sessions: {
      create(
        params: Stripe.Checkout.SessionCreateParams,
        options: { readonly idempotencyKey: string }
      ): Promise<
        Pick<Stripe.Checkout.Session, 'customer' | 'expires_at' | 'id' | 'url'>
      >;
    };
  };
  readonly customers: {
    create(
      params: Stripe.CustomerCreateParams
    ): Promise<Pick<Stripe.Customer, 'id'>>;
    search(params: Stripe.CustomerSearchParams): Promise<{
      readonly data: readonly Pick<Stripe.Customer, 'id'>[];
    }>;
  };
};

function activeCheckoutKey(options: {
  readonly cardType: SailingCardType;
  readonly cardYear: number;
  readonly dueTodayPriceId: string;
  readonly userId: string;
}) {
  return [
    'membership',
    options.userId,
    options.cardYear,
    options.cardType,
    options.dueTodayPriceId,
  ].join(':');
}

async function cancelUncreatedMembershipCheckoutPayment(options: {
  readonly client: MembershipCheckoutClient;
  readonly paymentId: string;
}) {
  await options.client.payment.update({
    data: {
      activeCheckoutKey: null,
      status: PaymentStatus.cancelled,
    },
    where: { id: options.paymentId },
  });
}

function consentSnapshot(options: {
  readonly cardType: SailingCardType;
  readonly dueTodayPrice: SailingCardMembershipPriceRow;
  readonly now: Date;
}) {
  const snapshot = {
    acceptedAtIso: options.now.toISOString(),
    amountDueTodayCents: options.dueTodayPrice.amountCents,
    cardType: options.cardType,
    paymentMethodDisclosureKey: 'membership_checkout_wallet_payment_disclosure',
    submitButtonTextKey: 'membership_checkout_submit',
    termsVersion: '2026-06-06-payment-only',
  };
  return {
    ...snapshot,
    termsHash: createHash('sha256')
      .update(JSON.stringify(snapshot))
      .digest('hex'),
  };
}

export async function createMembershipCheckoutForOnboarding(options: {
  readonly cancelUrl: string;
  readonly cardType: SailingCardType;
  readonly client: MembershipCheckoutClient;
  readonly dueTodayPrice: SailingCardMembershipPriceRow;
  readonly now: Date;
  readonly stripe: MembershipCheckoutStripe;
  readonly successUrl: string;
  readonly user: MembershipCheckoutUser;
}): Promise<
  | { readonly status: 'created'; readonly url: string }
  | { readonly status: 'not_eligible' }
> {
  const access = membershipAccessForOnboardingFlags({
    hasFitnessMembership: false,
    sailingAffiliation: options.user.sailingAffiliation,
  });
  if (!canRequestPaidRacingMembership({ access, cardType: options.cardType })) {
    return { status: 'not_eligible' };
  }

  const cardYear = getCurrentSailingCardYear(options.now);
  const checkoutKey = activeCheckoutKey({
    cardType: options.cardType,
    cardYear,
    dueTodayPriceId: options.dueTodayPrice.id,
    userId: options.user.id,
  });
  const existing = await options.client.payment.findFirst({
    select: {
      id: true,
      stripeCheckoutSessionExpiresAt: true,
      stripeCheckoutSessionUrl: true,
    },
    where: {
      activeCheckoutKey: checkoutKey,
      status: PaymentStatus.checkout_created,
      stripeCheckoutSessionUrl: { not: null },
      userId: options.user.id,
    },
  });
  if (
    existing?.stripeCheckoutSessionUrl &&
    existing.stripeCheckoutSessionExpiresAt !== null &&
    existing.stripeCheckoutSessionExpiresAt.getTime() > options.now.getTime()
  ) {
    return {
      status: 'created',
      url: existing.stripeCheckoutSessionUrl,
    };
  }
  if (existing) {
    await options.client.payment.update({
      data: {
        activeCheckoutKey: null,
        status: PaymentStatus.past_due,
      },
      where: { id: existing.id },
    });
  }

  const customerId = await getOrCreateMembershipStripeCustomer({
    client: options.client,
    email: options.user.email,
    name: options.user.name,
    stripe: options.stripe,
    userId: options.user.id,
  });
  const payment = await options.client.payment.create({
    data: {
      activeCheckoutKey: checkoutKey,
      amountCents: options.dueTodayPrice.amountCents,
      cardType: options.cardType,
      cardYear,
      currency: options.dueTodayPrice.currency,
      membershipConsentSnapshot: consentSnapshot({
        cardType: options.cardType,
        dueTodayPrice: options.dueTodayPrice,
        now: options.now,
      }),
      membershipInitialPriceId: options.dueTodayPrice.id,
      purpose: PaymentPurpose.membership,
      source: PaymentSource.stripe,
      status: PaymentStatus.pending,
      stripeCustomerId: customerId,
      userId: options.user.id,
    },
  });
  if (
    payment.cardType === null ||
    payment.cardYear === null ||
    payment.userId === null
  ) {
    await cancelUncreatedMembershipCheckoutPayment({
      client: options.client,
      paymentId: payment.id,
    });
    throw new Error('Created membership payment is missing required fields.');
  }

  let session: Awaited<
    ReturnType<typeof createStripeMembershipCheckoutSession>
  >;
  try {
    session = await createStripeMembershipCheckoutSession({
      cancelUrl: options.cancelUrl,
      customerId,
      initialPrice: options.dueTodayPrice,
      payment: {
        activeCheckoutKey: checkoutKey,
        cardType: payment.cardType,
        cardYear: payment.cardYear,
        id: payment.id,
        userId: payment.userId,
      },
      stripe: options.stripe,
      successUrl: options.successUrl,
    });
  } catch (error) {
    await cancelUncreatedMembershipCheckoutPayment({
      client: options.client,
      paymentId: payment.id,
    });
    throw error;
  }
  try {
    await options.client.payment.update({
      data: {
        status: PaymentStatus.checkout_created,
        stripeCheckoutSessionExpiresAt: session.expiresAt,
        stripeCheckoutSessionId: session.checkoutSessionId,
        stripeCheckoutSessionUrl: session.url,
        stripeCustomerId: session.customerId,
      },
      where: { id: payment.id },
    });
  } catch (error) {
    await cancelUncreatedMembershipCheckoutPayment({
      client: options.client,
      paymentId: payment.id,
    });
    throw error;
  }

  return { status: 'created', url: session.url };
}

export async function createMembershipCheckoutUrlForOnboarding(options: {
  readonly cancelUrl: string;
  readonly cardType: SailingCardType;
  readonly dateOfBirth: string;
  readonly email: string;
  readonly name: string | null;
  readonly sailingAffiliation: SailingAffiliation;
  readonly successUrl: string;
  readonly userId: string;
}) {
  const now = new Date();
  const prices = await getCheckoutMembershipPrices({
    affiliation: options.sailingAffiliation,
    cardType: options.cardType,
    dateOfBirth: options.dateOfBirth,
    now,
  });
  if (prices.status !== 'ready') {
    if (prices.status === 'missing_due_today_price') {
      logger.error(
        '[membership-checkout:onboarding] user_id={userId} card_type={cardType} reason=missing_due_today_price',
        {
          cardType: options.cardType,
          userId: options.userId,
        }
      );
    }
    return;
  }
  const result = await createMembershipCheckoutForOnboarding({
    cancelUrl: options.cancelUrl,
    cardType: options.cardType,
    client: prisma,
    dueTodayPrice: prices.dueTodayPrice,
    now,
    stripe: getStripeClient(),
    successUrl: options.successUrl,
    user: {
      dateOfBirth: options.dateOfBirth,
      email: options.email,
      id: options.userId,
      name: options.name,
      sailingAffiliation: options.sailingAffiliation,
    },
  });
  return result;
}
