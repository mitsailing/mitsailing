import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProfileMembershipBillingView } from '@/components/mit-sailing/profile/ProfileMembershipBillingView';
import { PaymentPurpose } from '@/generated/prisma/enums';
import { EVENTS_TIME_ZONE } from '@/lib/mit-sailing/nyTime';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { membershipProfileState } from '@/libs/mit-sailing/membershipBilling/membershipSubscriptions';
import { membershipAccessForSailingCardUser } from '@/libs/mit-sailing/sailingCardMembershipEligibility';
import { getI18nPath } from '@/utils/Helpers';

type ProfileMembershipPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

function profileDateLabel(date: Date | null, locale: string) {
  if (!date) {
    return null;
  }
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: EVENTS_TIME_ZONE,
    year: 'numeric',
  }).format(date);
}

export async function generateMetadata(
  props: ProfileMembershipPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'UserProfilePage' });

  return {
    description: t('membership_meta_description'),
    title: t('membership_meta_title'),
  };
}

export default async function ProfileMembershipPage(
  props: ProfileMembershipPageProps
) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const user = await requireCurrentUser(
    locale,
    getI18nPath('/profile/membership', locale)
  );
  const [dbUser, latestPayment, t] = await Promise.all([
    prisma.user.findUnique({
      select: {
        gymMembershipVerifiedAt: true,
        sailingAffiliation: true,
        sailingCardSubscriptions: {
          orderBy: { updatedAt: 'desc' },
          select: {
            autoRenew: true,
            cancelAtPeriodEnd: true,
            canonicalSubscriptionId: true,
            cardType: true,
            currentPeriodEnd: true,
            id: true,
            status: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true,
          },
          take: 1,
        },
      },
      where: { id: user.id },
    }),
    prisma.payment.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        amountCents: true,
        id: true,
        issueKind: true,
        status: true,
        stripeReceiptUrl: true,
      },
      where: {
        purpose: PaymentPurpose.membership,
        userId: user.id,
      },
    }),
    getTranslations({ locale, namespace: 'UserProfilePage' }),
  ]);
  if (!dbUser) {
    throw new Error('Missing db user after auth');
  }

  const subscription = dbUser.sailingCardSubscriptions.at(0) ?? null;
  const state = membershipProfileState({
    access:
      membershipAccessForSailingCardUser(dbUser).kind === 'free_normal'
        ? 'free_normal'
        : 'paid_racing_available',
    latestPayment,
    subscription,
  });

  return (
    <ProfileMembershipBillingView
      accessThroughLabel={profileDateLabel(state.accessThrough, locale)}
      amountCents={state.amountCents}
      canOpenBillingPortal={state.canOpenBillingPortal}
      canTurnOffAutoRenew={state.canTurnOffAutoRenew}
      cardType={state.cardType}
      kind={state.kind}
      locale={locale}
      receiptUrl={state.receiptUrl}
      subscriptionId={subscription?.id ?? null}
      t={t}
    />
  );
}
