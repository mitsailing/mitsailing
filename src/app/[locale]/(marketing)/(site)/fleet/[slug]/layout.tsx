import { getTranslations } from 'next-intl/server';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { getFleetBoatForPublicBySlug } from '@/libs/mit-sailing/fleetQueries';

export default async function FleetBoatSectionLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  const boat = await getFleetBoatForPublicBySlug(slug);
  const titleLabel = boat?.name ?? t('title_boat_unknown');

  return (
    <SiteSectionShell
      locale={locale}
      segments={[
        { label: t('section_fleet'), href: '/fleet' },
        { label: titleLabel },
      ]}
    >
      <SiteSectionMain variant="detail">{props.children}</SiteSectionMain>
    </SiteSectionShell>
  );
}
