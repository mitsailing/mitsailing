'use server';

import { redirect } from 'next/navigation';
import { SailingCardSubscriptionStatus } from '@/generated/prisma/enums';
import { getSession } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { createMembershipBillingPortalSession } from '@/libs/mit-sailing/membershipBilling/membershipBillingPortalSession';
import { getStripeClient } from '@/libs/stripe/stripeClient';
import { getI18nPath } from '@/utils/Helpers';

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
      status: {
        in: [
          SailingCardSubscriptionStatus.active,
          SailingCardSubscriptionStatus.trialing,
          SailingCardSubscriptionStatus.past_due,
        ],
      },
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
