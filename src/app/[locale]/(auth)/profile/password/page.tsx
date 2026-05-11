import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireCurrentUser } from '@/libs/auth/dal';
import { getI18nPath } from '@/utils/Helpers';
import { ProfilePasswordClient } from '../ProfilePasswordClient';

type ProfilePasswordPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: ProfilePasswordPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'UserProfilePage' });

  return {
    title: t('password_meta_title'),
    description: t('password_meta_description'),
  };
}

export default async function ProfilePasswordPage(
  props: ProfilePasswordPageProps
) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  await requireCurrentUser(locale, getI18nPath('/profile/account', locale));

  return <ProfilePasswordClient />;
}
