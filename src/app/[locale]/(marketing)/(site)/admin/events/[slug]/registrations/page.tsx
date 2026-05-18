import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminEventRegistrationsView } from '@/components/mit-sailing/admin/events/AdminEventRegistrationsView';
import {
  getEventAccessWhere,
  requireAdminEventAccess,
} from '@/libs/admin/events/eventAdminAuthorization';
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
  const access = await requireAdminEventAccess({ locale, slug });
  if (!access) {
    notFound();
  }
  const eventAccessWhere = getEventAccessWhere(access.ability);
  if (!eventAccessWhere) {
    notFound();
  }
  const [event, t] = await Promise.all([
    getAdminEventRegistrationsBySlug({ eventAccessWhere, slug }),
    getTranslations({ locale, namespace: 'AdminEvents' }),
  ]);
  if (!event) {
    notFound();
  }
  return (
    <AdminEventRegistrationsView
      errorCode={errorCode ?? null}
      event={event}
      filter={registrationFilterFromParam(status)}
      locale={locale}
      t={t}
    />
  );
}
