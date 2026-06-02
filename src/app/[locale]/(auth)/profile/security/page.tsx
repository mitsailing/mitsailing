import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireCurrentUser } from '@/libs/auth/dal';
import { getI18nPath } from '@/utils/Helpers';
import { ProfileSecurityClient } from '../ProfileSecurityClient';

type ProfileSecurityPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: ProfileSecurityPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'UserProfilePage' });

  return {
    title: t('security_meta_title'),
    description: t('security_meta_description'),
  };
}

export default async function ProfileSecurityPage(
  props: ProfileSecurityPageProps
) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  await requireCurrentUser(locale, getI18nPath('/profile', locale));

  return <ProfileSecurityClient />;
}
