import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { getI18nPath } from '@/utils/Helpers';
import { ProfileAccountClient } from '../ProfileAccountClient';

type ProfileAccountPageProps = {
  params: Promise<{ locale: string }>;
};

type EmailDeliverabilityStatus = 'ok' | 'bounced' | 'suppressed';

type EmailDeliverabilityUser = {
  emailBouncedAt: Date | null;
  emailSuppressedAt: Date | null;
  emailSuppressionReason: string | null;
};

/**
 * Maps provider deliverability fields to the account warning state.
 *
 * @param user - User deliverability fields from Resend webhooks
 * @returns Suppressed before bounced because complaints/suppressions are terminal
 */
function emailDeliverabilityStatus(
  user: EmailDeliverabilityUser
): EmailDeliverabilityStatus {
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
      initialName={user.name}
      initialThemePreference={dbUser.themePreference ?? 'SYSTEM'}
      initialUnconfirmedEmail={dbUser.unconfirmedEmail ?? null}
    />
  );
}
