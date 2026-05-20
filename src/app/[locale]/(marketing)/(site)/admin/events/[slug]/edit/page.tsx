import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminEventFormView } from '@/components/mit-sailing/admin/events/AdminEventFormView';
import { requireAdminEventAccess } from '@/libs/admin/events/eventAdminAuthorization';
import { getAdminEventEditorDataBySlug } from '@/libs/admin/events/eventAdminQueries';

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
  return { title: t('meta_title_admin_event_edit', { slug }) };
}

export default async function AdminEventEditPage(props: PageProps) {
  const { locale, slug } = await props.params;
  const { error: errorCode } = await props.searchParams;
  setRequestLocale(locale);
  const access = await requireAdminEventAccess({
    locale,
    minimumAccessMode: 'readOnly',
    slug,
  });
  if (!access) {
    notFound();
  }
  const [data, t, tCommon] = await Promise.all([
    getAdminEventEditorDataBySlug({ db: access.db, slug }),
    getTranslations({ locale, namespace: 'AdminEvents' }),
    getTranslations({ locale, namespace: 'Common' }),
  ]);
  if (!data.event) {
    notFound();
  }
  return (
    <AdminEventFormView
      accessMode={access.accessMode}
      categories={data.categories}
      errorCode={errorCode ?? null}
      event={data.event}
      locale={locale}
      t={t}
      tCommon={tCommon}
      users={data.users}
    />
  );
}
