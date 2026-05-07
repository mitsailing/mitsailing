import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminEventCreateFormView } from '@/components/mit-sailing/admin/events/AdminEventCreateFormView';
import { listAdminEventCategories } from '@/libs/admin/events/eventAdminQueries';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_admin_event_new') };
}

export default async function AdminEventNewPage(props: PageProps) {
  const { locale } = await props.params;
  const { error: errorCode } = await props.searchParams;
  setRequestLocale(locale);
  const [categories, t] = await Promise.all([
    listAdminEventCategories(),
    getTranslations({ locale, namespace: 'AdminEvents' }),
  ]);
  return (
    <AdminEventCreateFormView
      categories={categories}
      errorCode={errorCode ?? null}
      locale={locale}
      t={t}
    />
  );
}
