import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProfileMembershipBillingView } from '@/components/mit-sailing/profile/ProfileMembershipBillingView';
import { PaymentPurpose } from '@/generated/prisma/enums';
import { EVENTS_TIME_ZONE } from '@/lib/mit-sailing/nyTime';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { membershipProfileState } from '@/libs/mit-sailing/membershipBilling/membershipProfileState';
import { membershipAccessForSailingCardUser } from '@/libs/mit-sailing/sailingCardMembershipEligibility';
import { getCurrentSailingCardYear } from '@/libs/mit-sailing/sailingCardValidity';
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
  const now = new Date();
  const [dbUser, latestPayment, t] = await Promise.all([
    prisma.user.findUnique({
      select: {
        gymMembershipVerifiedAt: true,
        sailingAffiliation: true,
      },
      where: { id: user.id },
    }),
    prisma.payment.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        amountCents: true,
        amountPaidCents: true,
        cardType: true,
        cardYear: true,
        id: true,
        issueKind: true,
        source: true,
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

  const state = membershipProfileState({
    access:
      membershipAccessForSailingCardUser(dbUser).kind === 'free_normal'
        ? 'free_normal'
        : 'paid_racing_available',
    cardYear: getCurrentSailingCardYear(now),
    latestPayment,
  });

  return (
    <ProfileMembershipBillingView
      accessThroughLabel={profileDateLabel(state.accessThrough, locale)}
      amountCents={state.amountCents}
      cardType={state.cardType}
      kind={state.kind}
      locale={locale}
      receiptUrl={state.receiptUrl}
      t={t}
    />
  );
}
