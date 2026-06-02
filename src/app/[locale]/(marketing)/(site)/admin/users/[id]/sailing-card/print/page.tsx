import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import { SailingCardPrintPage } from '../SailingCardPrintPage';

type AdminUserSailingCardPrintPageProps = {
  readonly params: Promise<{ id: string; locale: string }>;
};

export default async function AdminUserSailingCardPrintPage(
  props: AdminUserSailingCardPrintPageProps
) {
  const { id, locale } = await props.params;
  await requirePermission(Permission.CARDS_PRINT, locale);

  return <SailingCardPrintPage id={id} locale={locale} mode="print" />;
}
