import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ClassesCatalogView } from '@/components/mit-sailing/classes/ClassesCatalogView';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { listSailingClassesGroupedForCatalog } from '@/libs/mit-sailing/classQueries';

export const revalidate = 900;

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_classes') };
}

export default async function ClassesListPage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  const grouped = await listSailingClassesGroupedForCatalog();
  return (
    <SiteSectionShell
      locale={locale}
      segments={[{ label: t('section_classes') }]}
    >
      <ClassesCatalogView grouped={grouped} locale={locale} />
    </SiteSectionShell>
  );
}
