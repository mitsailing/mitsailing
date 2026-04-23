import { getTranslations } from 'next-intl/server';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';

export default async function ClassesSectionLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return (
    <SiteSectionShell locale={locale} sectionTitle={t('section_classes')}>
      {props.children}
    </SiteSectionShell>
  );
}
