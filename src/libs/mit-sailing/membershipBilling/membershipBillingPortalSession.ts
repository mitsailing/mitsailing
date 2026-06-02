import type { Stripe } from 'stripe';

export type MembershipBillingPortalStripe = {
  readonly billingPortal: {
    readonly sessions: {
      create(
        params: Stripe.BillingPortal.SessionCreateParams
      ): Promise<Pick<Stripe.BillingPortal.Session, 'id' | 'url'>>;
    };
  };
};

export async function createMembershipBillingPortalSession(options: {
  readonly configurationId: string;
  readonly customerId: string;
  readonly returnUrl: string;
  readonly stripe: MembershipBillingPortalStripe;
}): Promise<{ readonly url: string }> {
  const session = await options.stripe.billingPortal.sessions.create({
    configuration: options.configurationId,
    customer: options.customerId,
    return_url: options.returnUrl,
  });
  if (!session.url) {
    throw new Error('Stripe did not return a Billing Portal URL.');
  }
  return { url: session.url };
}
