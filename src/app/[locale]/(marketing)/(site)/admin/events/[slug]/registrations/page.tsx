import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { adminEventShowPath } from '@/libs/admin/events/eventAdminPaths';
import { getI18nPath } from '@/utils/Helpers';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ error?: string; status?: string }>;
};

function canonicalRegistrationsReviewPath(props: {
  errorCode?: string;
  locale: string;
  slug: string;
  status?: string;
}): string {
  const query = new URLSearchParams();
  if (props.errorCode) {
    query.set('error', props.errorCode);
  }
  if (
    props.status === 'pending' ||
    props.status === 'approved' ||
    props.status === 'cancelled'
  ) {
    query.set('status', props.status);
  }
  const queryString = query.toString();
  return `${getI18nPath(adminEventShowPath(props.slug), props.locale)}${
    queryString ? `?${queryString}` : ''
  }#registrations`;
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
  redirect(
    canonicalRegistrationsReviewPath({
      errorCode,
      locale,
      slug,
      status,
    })
  );
}
