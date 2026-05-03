import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { getBaseUrl, getI18nPath } from '@/utils/Helpers';
import { ProfileAccountClient } from '../ProfileAccountClient';

type ProfileAccountPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ emailChanged?: string; error?: string }>;
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

  const profileAccountHref = getI18nPath('/profile/account/', locale);
  const user = await requireCurrentUser(locale, profileAccountHref);
  const { emailChanged, error } = await props.searchParams;
  let verificationBanner: 'success' | 'error' | null = null;
  if (error) {
    verificationBanner = 'error';
  } else if (emailChanged) {
    verificationBanner = 'success';
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { unconfirmedEmail: true },
  });

  return (
    <ProfileAccountClient
      emailChangeCallbackUrl={`${getBaseUrl()}${profileAccountHref}?emailChanged=1`}
      initialEmail={user.email ?? ''}
      initialName={user.name}
      initialUnconfirmedEmail={dbUser?.unconfirmedEmail ?? null}
      initialVerificationBanner={verificationBanner}
    />
  );
}
