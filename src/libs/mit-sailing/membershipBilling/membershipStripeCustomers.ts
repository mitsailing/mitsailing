import 'server-only';
import type { Stripe } from 'stripe';

export type MembershipStripeCustomerClient = {
  readonly payment: {
    findFirst(args: {
      readonly orderBy: { readonly updatedAt: 'desc' };
      readonly select: { readonly stripeCustomerId: true };
      readonly where: {
        readonly stripeCustomerId: { readonly not: null };
        readonly userId: string;
      };
    }): Promise<{ readonly stripeCustomerId: string | null } | null>;
  };
  readonly sailingCardSubscription: {
    findFirst(args: {
      readonly orderBy: { readonly updatedAt: 'desc' };
      readonly select: { readonly stripeCustomerId: true };
      readonly where: { readonly userId: string };
    }): Promise<{ readonly stripeCustomerId: string } | null>;
  };
};

export type MembershipStripeCustomerStripe = {
  readonly customers: {
    create(
      params: Stripe.CustomerCreateParams
    ): Promise<Pick<Stripe.Customer, 'id'>>;
    search(params: Stripe.CustomerSearchParams): Promise<{
      readonly data: readonly Pick<Stripe.Customer, 'id'>[];
    }>;
  };
};

const membershipStripeCustomerDomain = 'sailing_card_membership';

function stripeSearchEmail(value: string) {
  const backslash = String.fromCodePoint(92);
  return value
    .replaceAll(backslash, `${backslash}${backslash}`)
    .replaceAll("'", `${backslash}'`);
}

export async function getOrCreateMembershipStripeCustomer(options: {
  readonly client: MembershipStripeCustomerClient;
  readonly email: string;
  readonly name: string | null;
  readonly stripe: MembershipStripeCustomerStripe;
  readonly userId: string;
}): Promise<string> {
  const subscription = await options.client.sailingCardSubscription.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { stripeCustomerId: true },
    where: { userId: options.userId },
  });
  if (subscription) {
    return subscription.stripeCustomerId;
  }

  const payment = await options.client.payment.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { stripeCustomerId: true },
    where: {
      stripeCustomerId: { not: null },
      userId: options.userId,
    },
  });
  if (payment?.stripeCustomerId) {
    return payment.stripeCustomerId;
  }

  const existing = await options.stripe.customers.search({
    limit: 1,
    query: `email:'${stripeSearchEmail(options.email)}'`,
  });
  const existingCustomerId = existing.data[0]?.id;
  if (existingCustomerId) {
    return existingCustomerId;
  }

  const customer = await options.stripe.customers.create({
    email: options.email,
    metadata: {
      domain: membershipStripeCustomerDomain,
      userId: options.userId,
    },
    name: options.name ?? undefined,
  });
  return customer.id;
}
