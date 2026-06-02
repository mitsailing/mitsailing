import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import { SailingCardPrintPage } from '../SailingCardPrintPage';

type AdminUserSailingCardQuickPrintPageProps = {
  readonly params: Promise<{ id: string; locale: string }>;
};

export default async function AdminUserSailingCardQuickPrintPage(
  props: AdminUserSailingCardQuickPrintPageProps
) {
  const { id, locale } = await props.params;
  await requirePermission(Permission.CARDS_PRINT, locale);

  return <SailingCardPrintPage id={id} locale={locale} mode="quick" />;
}
