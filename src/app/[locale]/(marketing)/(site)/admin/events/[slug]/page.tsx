import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { RegistrationFilter } from '@/components/mit-sailing/admin/events/AdminEventRegistrationsView';
import { AdminEventShowView } from '@/components/mit-sailing/admin/events/AdminEventShowView';
import { requireAdminEventAccess } from '@/libs/admin/events/eventAdminAuthorization';
import { getAdminEventShowBySlug } from '@/libs/admin/events/eventAdminQueries';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ error?: string; status?: string }>;
};

function registrationFilterFromParam(
  status: string | undefined
): RegistrationFilter {
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
  return { title: t('meta_title_admin_event_show', { slug }) };
}

export default async function AdminEventShowPage(props: PageProps) {
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
    getAdminEventShowBySlug({
      accessMode: access.accessMode,
      db: access.db,
      slug,
    }),
    getTranslations({ locale, namespace: 'AdminEvents' }),
  ]);
  if (!event) {
    notFound();
  }
  return (
    <AdminEventShowView
      errorCode={errorCode ?? null}
      event={event}
      filter={registrationFilterFromParam(status)}
      locale={locale}
      statusCode={status === 'saved' ? status : null}
      t={t}
    />
  );
}
