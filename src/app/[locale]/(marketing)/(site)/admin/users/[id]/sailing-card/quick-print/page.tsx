import {
  redirectToSailingCardPdf,
  sailingCardPdfRedirectParams,
} from '@/app/[locale]/(marketing)/(site)/admin/users/[id]/sailing-card/SailingCardPdfRedirectPage';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';

export default async function AdminUserSailingCardQuickPrintPage(
  props: Parameters<typeof sailingCardPdfRedirectParams>[0]
) {
  const { id, locale } = await sailingCardPdfRedirectParams(props);
  await requirePermission(Permission.CARDS_PRINT, locale);

  redirectToSailingCardPdf(id);
}
