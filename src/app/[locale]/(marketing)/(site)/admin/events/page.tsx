import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminEventsListView } from '@/components/mit-sailing/admin/events/AdminEventsListView';
import {
  listAdminEventCategories,
  listAdminEventRows,
} from '@/libs/admin/events/eventAdminQueries';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_admin_events') };
}

export default async function AdminEventsListPage(props: PageProps) {
  const { locale } = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(locale);
  const [categories, rows, t] = await Promise.all([
    listAdminEventCategories(),
    listAdminEventRows({
      categoryId: searchParams.category,
      query: searchParams.q,
    }),
    getTranslations({ locale, namespace: 'AdminEvents' }),
  ]);
  return (
    <AdminEventsListView
      categories={categories}
      filters={{
        categoryId: searchParams.category,
        query: searchParams.q,
      }}
      rows={rows}
      t={t}
    />
  );
}
