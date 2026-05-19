import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminEventRegistrationsView } from '@/components/mit-sailing/admin/events/AdminEventRegistrationsView';
import { requireAdminEventAccess } from '@/libs/admin/events/eventAdminAuthorization';
import { getAdminEventRegistrationsBySlug } from '@/libs/admin/events/eventAdminQueries';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ error?: string; status?: string }>;
};

function registrationFilterFromParam(
  status: string | undefined
): 'all' | 'pending' | 'approved' | 'cancelled' {
  if (status === 'pending' || status === 'approved' || status === 'cancelled') {
    return status;
  }
  return 'all';
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_admin_registrations', { slug }) };
}

export default async function AdminEventRegistrationsPage(props: PageProps) {
  const { locale, slug } = await props.params;
  const { error: errorCode, status } = await props.searchParams;
  setRequestLocale(locale);
  const access = await requireAdminEventAccess({
    locale,
    minimumAccessMode: 'readOnly',
    slug,
  });
  if (!access) {
    notFound();
  }
  const [event, t] = await Promise.all([
    getAdminEventRegistrationsBySlug({ db: access.db, slug }),
    getTranslations({ locale, namespace: 'AdminEvents' }),
  ]);
  if (!event) {
    notFound();
  }
  return (
    <AdminEventRegistrationsView
      accessMode={access.accessMode}
      errorCode={errorCode ?? null}
      event={event}
      filter={registrationFilterFromParam(status)}
      locale={locale}
      t={t}
    />
  );
}
