import 'server-only';
import type { Stripe } from 'stripe';
import type { SailingCardType } from '@/generated/prisma/enums';
import { membershipBillingAnchorForCheckout } from '@/libs/mit-sailing/membershipBilling/membershipBillingDates';
import type { SailingCardMembershipPriceRow } from '@/libs/mit-sailing/membershipBilling/membershipPricing';

type MembershipCheckoutPrice = Pick<
  SailingCardMembershipPriceRow,
  'amountCents' | 'currency' | 'id' | 'stripePriceId'
>;

type MembershipCheckoutPayment = {
  readonly activeCheckoutKey: string;
  readonly cardType: SailingCardType;
  readonly cardYear: number;
  readonly id: string;
  readonly userId: string;
};

type MembershipStripeCheckoutSession = Pick<
  Stripe.Checkout.Session,
  'customer' | 'expires_at' | 'id' | 'url'
>;

type MembershipStripeCheckoutCreator = {
  readonly checkout: {
    readonly sessions: {
      create(
        params: Stripe.Checkout.SessionCreateParams,
        options: { readonly idempotencyKey: string }
      ): Promise<MembershipStripeCheckoutSession>;
    };
  };
};

export type MembershipCheckoutSessionResult =
  | {
      readonly checkoutSessionId: string;
      readonly customerId: string;
      readonly expiresAt: Date;
      readonly status: 'created';
      readonly url: string;
    }
  | { readonly status: 'rollover_blocked' };

const checkoutRolloverBlockMs = 48 * 60 * 60 * 1000;
const stripeMembershipDomain = 'sailing_card_membership';

function assertStripeReadyPrice(
  price: MembershipCheckoutPrice
): asserts price is MembershipCheckoutPrice & {
  readonly stripePriceId: string;
} {
  if (!price.stripePriceId) {
    throw new TypeError('Membership checkout requires Stripe-synced Prices.');
  }
  if (price.currency !== 'usd') {
    throw new TypeError('Membership checkout only supports usd prices.');
  }
  if (!Number.isInteger(price.amountCents) || price.amountCents <= 0) {
    throw new TypeError('Membership checkout requires positive price amounts.');
  }
}

function stripeExpandableId(value: string | { id: string } | null) {
  if (typeof value === 'string') {
    return value;
  }
  return value?.id ?? null;
}

export function membershipCheckoutAvailability(
  now: Date
): 'available' | 'rollover_blocked' {
  const renewalAt = membershipBillingAnchorForCheckout(now);
  const msUntilRenewal = renewalAt.getTime() - now.getTime();
  if (msUntilRenewal > 0 && msUntilRenewal <= checkoutRolloverBlockMs) {
    return 'rollover_blocked';
  }
  return 'available';
}

export async function createStripeMembershipCheckoutSession(options: {
  readonly cancelUrl: string;
  readonly customerId: string;
  readonly initialPrice: MembershipCheckoutPrice;
  readonly now: Date;
  readonly payment: MembershipCheckoutPayment;
  readonly renewalPrice: MembershipCheckoutPrice;
  readonly stripe: MembershipStripeCheckoutCreator;
  readonly successUrl: string;
}): Promise<MembershipCheckoutSessionResult> {
  if (membershipCheckoutAvailability(options.now) === 'rollover_blocked') {
    return { status: 'rollover_blocked' };
  }
  assertStripeReadyPrice(options.initialPrice);
  assertStripeReadyPrice(options.renewalPrice);

  const metadata = {
    activeCheckoutKey: options.payment.activeCheckoutKey,
    cardType: options.payment.cardType,
    cardYear: String(options.payment.cardYear),
    domain: stripeMembershipDomain,
    initialMembershipPriceId: options.initialPrice.id,
    localPaymentId: options.payment.id,
    renewalMembershipPriceId: options.renewalPrice.id,
    userId: options.payment.userId,
  };
  const session = await options.stripe.checkout.sessions.create(
    {
      client_reference_id: options.payment.id,
      customer: options.customerId,
      line_items: [
        { price: options.renewalPrice.stripePriceId, quantity: 1 },
        { price: options.initialPrice.stripePriceId, quantity: 1 },
      ],
      metadata,
      mode: 'subscription',
      after_expiration: {
        recovery: { enabled: true },
      },
      cancel_url: options.cancelUrl,
      success_url: options.successUrl,
      subscription_data: {
        billing_cycle_anchor: Math.floor(
          membershipBillingAnchorForCheckout(options.now).getTime() / 1000
        ),
        metadata,
        proration_behavior: 'none',
      },
    },
    { idempotencyKey: `membership-checkout-${options.payment.id}` }
  );
  if (!session.url) {
    throw new Error('Stripe did not return a membership Checkout URL.');
  }
  const customerId = stripeExpandableId(session.customer);
  if (!customerId) {
    throw new Error('Stripe did not return a membership customer ID.');
  }
  return {
    checkoutSessionId: session.id,
    customerId,
    expiresAt: new Date(session.expires_at * 1000),
    status: 'created',
    url: session.url,
  };
}
