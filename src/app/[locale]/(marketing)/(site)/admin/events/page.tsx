import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminEventsListView } from '@/components/mit-sailing/admin/events/AdminEventsListView';
import { requireAdminEventListAccess } from '@/libs/admin/events/eventAdminAuthorization';
import { adminEventsIndexPath } from '@/libs/admin/events/eventAdminPaths';
import {
  listAdminEventCategories,
  listAdminEventRows,
} from '@/libs/admin/events/eventAdminQueries';
import { getPathname } from '@/libs/I18nNavigation';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string; scope?: string }>;
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
  const access = await requireAdminEventListAccess(locale);
  const [categories, rows, t] = await Promise.all([
    listAdminEventCategories(),
    listAdminEventRows({
      authContext: access.authContext,
      categoryId: searchParams.category,
      query: searchParams.q,
      scope: searchParams.scope,
    }),
    getTranslations({ locale, namespace: 'AdminEvents' }),
  ]);
  const eventsListFilterAction = getPathname({
    href: adminEventsIndexPath(),
    locale,
  });
  return (
    <AdminEventsListView
      categories={categories}
      filterAction={eventsListFilterAction}
      filters={{
        categoryId: searchParams.category,
        query: searchParams.q,
        scope: searchParams.scope,
      }}
      rows={rows}
      t={t}
    />
  );
}
