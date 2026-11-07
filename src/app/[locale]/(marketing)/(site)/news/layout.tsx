import { getTranslations } from 'next-intl/server';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';

/**
 * @param props - Layout props
 * @param props.children - News page content
 * @param props.params - `[locale]` params
 * @returns Breadcrumb shell and catalog-width main column
 */
export default async function NewsSectionLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return (
    <SiteSectionShell locale={locale} segments={[{ label: t('section_news') }]}>
      <SiteSectionMain variant="catalog">{props.children}</SiteSectionMain>
    </SiteSectionShell>
  );
}
