import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { getI18nPath } from '@/utils/Helpers';
import { ProfileAccountClient } from '../ProfileAccountClient';

type ProfileAccountPageProps = {
  params: Promise<{ locale: string }>;
};

type EmailDeliverabilityStatus = 'ok' | 'bounced' | 'suppressed';

function emailDeliverabilityStatus(
  user: {
    emailBouncedAt: Date | null;
    emailSuppressedAt: Date | null;
    emailSuppressionReason: string | null;
  } | null
): EmailDeliverabilityStatus {
  if (!user) {
    return 'ok';
  }
  if (user.emailSuppressedAt || user.emailSuppressionReason) {
    return 'suppressed';
  }
  if (user.emailBouncedAt) {
    return 'bounced';
  }
  return 'ok';
}

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
      themePreference: true,
      unconfirmedEmail: true,
    },
    where: { id: user.id },
  });

  return (
    <ProfileAccountClient
      initialEmail={user.email ?? ''}
      initialEmailDeliverabilityStatus={emailDeliverabilityStatus(dbUser)}
      initialName={user.name}
      initialThemePreference={dbUser?.themePreference ?? 'SYSTEM'}
      initialUnconfirmedEmail={dbUser?.unconfirmedEmail ?? null}
    />
  );
}
