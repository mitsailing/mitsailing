import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { requireAdminAreaAccess } from '@/libs/admin/adminAreaAccess';
import { adminLandingPath } from '@/libs/admin/adminNavigation';
import { getI18nPath } from '@/utils/Helpers';

type AdminIndexPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: AdminIndexPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AdminIndex' });
  return { title: t('meta_title') };
}

/**
 * `GET /admin` — redirects to the first admin section the user may access.
 *
 * @param props - App Router page props
 * @returns Never returns; redirects to a permitted admin route
 */
export default async function AdminIndexPage(props: AdminIndexPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const { navItems } = await requireAdminAreaAccess(locale);
  const landingPath = adminLandingPath(navItems);
  redirect(getI18nPath(landingPath, locale));
}
