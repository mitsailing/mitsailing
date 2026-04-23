import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { getBaseUrl, getI18nPath } from '@/utils/Helpers';
import { UserProfileClient } from './UserProfileClient';

type UserProfilePageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ emailChanged?: string; error?: string }>;
};

export async function generateMetadata(
  props: UserProfilePageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'UserProfilePage' });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function UserProfilePage(props: UserProfilePageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const profileHref = getI18nPath('/account/profile/', locale);
  const user = await requireCurrentUser(locale, profileHref);
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
    <UserProfileClient
      emailChangeCallbackUrl={`${getBaseUrl()}${profileHref}?emailChanged=1`}
      initialEmail={user.email ?? ''}
      initialName={user.name}
      initialUnconfirmedEmail={dbUser?.unconfirmedEmail ?? null}
      initialVerificationBanner={verificationBanner}
      signInHref={getI18nPath('/sign-in', locale)}
    />
  );
}
