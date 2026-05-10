import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireCurrentUser } from '@/libs/auth/dal';
import { getI18nPath } from '@/utils/Helpers';
import { ProfileDeleteAccountClient } from '../ProfileDeleteAccountClient';

type ProfileDeletePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: ProfileDeletePageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'UserProfilePage' });

  return {
    title: t('delete_meta_title'),
    description: t('delete_meta_description'),
  };
}

export default async function ProfileDeletePage(props: ProfileDeletePageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  await requireCurrentUser(locale, getI18nPath('/profile/account', locale));

  return (
    <ProfileDeleteAccountClient signInHref={getI18nPath('/login', locale)} />
  );
}
