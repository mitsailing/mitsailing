import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Permission } from '@/libs/auth/appPermissions';
import { requirePermission } from '@/libs/auth/dal';

type AdminCmsPageRevisionComparePageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * Old admin CMS revision URLs redirect into Payload; keep an explicit staff gate.
 *
 * @param props - Locale route params for the legacy admin revision URL
 */
export default async function AdminCmsPageRevisionComparePage(
  props: AdminCmsPageRevisionComparePageProps
) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  await requirePermission(Permission.CMS_EDIT, locale);
  redirect('/cms/collections/pages');
}
