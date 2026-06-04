import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';

type AdminUserSailingCardPrintPageProps = {
  readonly params: Promise<{ id: string; locale: string }>;
};

export default async function AdminUserSailingCardPrintPage(
  props: AdminUserSailingCardPrintPageProps
) {
  const { id, locale } = await props.params;
  setRequestLocale(locale);
  await requirePermission(Permission.CARDS_PRINT, locale);

  redirect(`/api/admin/users/${encodeURIComponent(id)}/sailing-card/pdf`);
}
