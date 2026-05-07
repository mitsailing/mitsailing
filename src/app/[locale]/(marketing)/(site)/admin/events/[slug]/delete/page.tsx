import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminEventDeleteView } from '@/components/mit-sailing/admin/events/AdminEventDeleteView';
import { getAdminEventDeleteBySlug } from '@/libs/admin/events/eventAdminQueries';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_admin_event_delete', { slug }) };
}

export default async function AdminEventDeletePage(props: PageProps) {
  const { locale, slug } = await props.params;
  const { error: errorCode } = await props.searchParams;
  setRequestLocale(locale);
  const [event, t] = await Promise.all([
    getAdminEventDeleteBySlug(slug),
    getTranslations({ locale, namespace: 'AdminEvents' }),
  ]);
  if (!event) {
    notFound();
  }
  return (
    <AdminEventDeleteView
      errorCode={errorCode ?? null}
      event={event}
      locale={locale}
      t={t}
    />
  );
}
