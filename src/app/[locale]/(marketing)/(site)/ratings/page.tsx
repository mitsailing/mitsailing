import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RatingsListView } from '@/components/mit-sailing/ratings/RatingsListView';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { listPublicSailingRatings } from '@/libs/mit-sailing/sailingRatingQueries';

export const revalidate = 900;

type RatingsPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata(
  props: RatingsPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'MitSailingRoutes' });
  return { title: t('meta_title_ratings') };
}

export default async function RatingsPage(props: RatingsPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'MitSailingRoutes' });
  const ratings = await listPublicSailingRatings();

  return (
    <SiteSectionShell
      locale={locale}
      segments={[{ label: t('section_ratings') }]}
    >
      <SiteSectionMain variant="catalog">
        <RatingsListView locale={locale} ratings={ratings} />
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
