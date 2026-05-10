import { getTranslations } from 'next-intl/server';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { getSailingClassCatalogBySlug } from '@/libs/mit-sailing/classQueries';

export default async function ClassDetailSectionLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug: raw } = await props.params;
  const slug = decodeURIComponent(raw);
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  const sailingClass = await getSailingClassCatalogBySlug(slug);
  const titleLabel = sailingClass?.name ?? t('title_class_unknown');

  return (
    <SiteSectionShell
      locale={locale}
      segments={[
        { label: t('section_classes'), href: '/classes' },
        { label: titleLabel },
      ]}
    >
      <SiteSectionMain variant="detail">{props.children}</SiteSectionMain>
    </SiteSectionShell>
  );
}
