import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { emailDeliverabilityStatus } from '@/libs/email/emailDeliverabilityStatus';
import { logger } from '@/libs/Logger';
import { getCurrentSailingCardYear } from '@/libs/mit-sailing/sailingCardValidity';
import { getI18nPath } from '@/utils/Helpers';
import { ProfileAccountClient } from '../ProfileAccountClient';

type ProfileAccountPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: ProfileAccountPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'UserProfilePage' });

  return {
    title: t('account_meta_title'),
    description: t('account_meta_description'),
  };
}

export default async function ProfileAccountPage(
  props: ProfileAccountPageProps
) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const profileAccountHref = getI18nPath('/profile/account', locale);
  const user = await requireCurrentUser(locale, profileAccountHref);

  const dbUser = await prisma.user.findUnique({
    select: {
      emailBouncedAt: true,
      emailSuppressedAt: true,
      emailSuppressionReason: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      gymMembershipVerifiedAt: true,
      phone: true,
      sailingCardRequests: {
        orderBy: { requestedAt: 'desc' },
        take: 1,
        where: {
          cardYear: getCurrentSailingCardYear(),
        },
        select: {
          cardType: true,
          cardYear: true,
          hasFitnessMembership: true,
          status: true,
        },
      },
      themePreference: true,
      unconfirmedEmail: true,
    },
    where: { id: user.id },
  });
  if (!dbUser) {
    logger.warn('Missing database user after profile auth', {
      email: user.email,
      userId: user.id,
    });
    throw new Error('Missing db user after auth');
  }

  return (
    <ProfileAccountClient
      initialEmail={user.email ?? ''}
      initialEmailDeliverabilityStatus={emailDeliverabilityStatus(dbUser)}
      initialEmergencyContactName={dbUser.emergencyContactName ?? ''}
      initialEmergencyContactPhone={dbUser.emergencyContactPhone ?? ''}
      initialGymMembershipVerifiedAt={
        dbUser.gymMembershipVerifiedAt?.toISOString() ?? null
      }
      initialName={user.name}
      initialPhone={dbUser.phone ?? ''}
      initialSailingCardRequest={dbUser.sailingCardRequests.at(0)}
      initialThemePreference={dbUser.themePreference ?? 'SYSTEM'}
      initialUnconfirmedEmail={dbUser.unconfirmedEmail ?? null}
      locale={locale}
    />
  );
}
