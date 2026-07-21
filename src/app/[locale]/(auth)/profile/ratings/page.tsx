import type { Metadata } from 'next';
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import { ProfileRatingsView } from '@/components/auth/profile/ProfileRatingsView';
import { requireCurrentUser } from '@/libs/auth/dal';
import { listUserRatingAssignmentRows } from '@/libs/mit-sailing/sailingRatingQueries';
import { getI18nPath } from '@/utils/Helpers';

type ProfileRatingsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: ProfileRatingsPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'UserProfilePage' });
  return {
    title: t('ratings_meta_title'),
    description: t('ratings_meta_description'),
  };
}

export default async function ProfileRatingsPage(
  props: ProfileRatingsPageProps
) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const user = await requireCurrentUser(
    locale,
    getI18nPath('/profile/ratings', locale)
  );
  const [rows, t, format] = await Promise.all([
    listUserRatingAssignmentRows(user.id, {
      includeDeprecated: false,
    }),
    getTranslations({ locale, namespace: 'UserProfilePage' }),
    getFormatter({ locale }),
  ]);

  return <ProfileRatingsView format={format} rows={rows} t={t} />;
}
