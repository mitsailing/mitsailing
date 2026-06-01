'use server';

import { redirect } from 'next/navigation';
import type { Stripe } from 'stripe';
import { getSession } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { getStripeClient } from '@/libs/stripe/stripeClient';
import { getI18nPath } from '@/utils/Helpers';

type MembershipBillingPortalStripe = {
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

export async function openMembershipBillingPortalAction(locale: string) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect(getI18nPath('/login', locale));
  }
  if (!Env.STRIPE_MEMBERSHIP_BILLING_PORTAL_CONFIGURATION_ID) {
    throw new Error('Membership Billing Portal is not configured.');
  }

  const subscription = await prisma.sailingCardSubscription.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { stripeCustomerId: true },
    where: {
      userId: session.user.id,
      status: { in: ['active', 'trialing', 'past_due'] },
    },
  });
  if (!subscription) {
    redirect(getI18nPath('/profile', locale));
  }

  const portalSession = await createMembershipBillingPortalSession({
    configurationId: Env.STRIPE_MEMBERSHIP_BILLING_PORTAL_CONFIGURATION_ID,
    customerId: subscription.stripeCustomerId,
    returnUrl: `${Env.NEXT_PUBLIC_APP_URL}${getI18nPath('/profile', locale)}`,
    stripe: getStripeClient(),
  });

  redirect(portalSession.url);
}
