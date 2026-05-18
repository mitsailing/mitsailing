import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminEventsListView } from '@/components/mit-sailing/admin/events/AdminEventsListView';
import { adminEventsIndexPath } from '@/libs/admin/events/eventAdminPaths';
import {
  listAdminEventCategories,
  listAdminEventRows,
} from '@/libs/admin/events/eventAdminQueries';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import { getPathname } from '@/libs/I18nNavigation';

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
  await requirePermission(Permission.EVENTS_MANAGE, locale);
  const [categories, rows, t] = await Promise.all([
    listAdminEventCategories(),
    listAdminEventRows({
      categoryId: searchParams.category,
      query: searchParams.q,
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
      }}
      rows={rows}
      t={t}
    />
  );
}
