import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

type PageProps = { params: Promise<{ locale: string; slug: string }> };

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
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return (
    <h1 className="text-2xl font-semibold">
      {t('title_admin_registrations', { slug })}
    </h1>
  );
}
