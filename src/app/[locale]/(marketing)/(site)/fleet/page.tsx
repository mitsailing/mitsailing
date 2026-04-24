import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FleetListView } from '@/components/mit-sailing/fleet/FleetListView';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { listFleetBoatsForPublic } from '@/libs/mit-sailing/fleetQueries';

export const revalidate = 900;

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_fleet') };
}

export default async function FleetListPage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  const boats = await listFleetBoatsForPublic();
  return (
    <SiteSectionShell
      locale={locale}
      segments={[{ label: t('section_fleet') }]}
    >
      <FleetListView boats={boats} locale={locale} />
    </SiteSectionShell>
  );
}
