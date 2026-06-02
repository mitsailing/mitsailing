import { setRequestLocale } from 'next-intl/server';
import { SailingCardPrintPage } from '@/app/[locale]/(marketing)/(site)/admin/users/[id]/sailing-card/SailingCardPrintPage';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';

type AdminUserSailingCardQuickPrintPageProps = {
  readonly params: Promise<{ id: string; locale: string }>;
};

export default async function AdminUserSailingCardQuickPrintPage(
  props: AdminUserSailingCardQuickPrintPageProps
) {
  const { id, locale } = await props.params;
  setRequestLocale(locale);
  await requirePermission(Permission.CARDS_PRINT, locale);

  return <SailingCardPrintPage id={id} locale={locale} mode="quick" />;
}
