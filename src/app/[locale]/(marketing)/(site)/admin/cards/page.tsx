import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { AdminSailingCardQueue } from '@/components/mit-sailing/admin/cards/AdminSailingCardQueue';
import { sailingCardReviewPermissions } from '@/libs/admin/cards/adminSailingCardPermissions';
import { getNextAvailableSailingCardNumber } from '@/libs/admin/cards/adminSailingCardQueries';
import { listPendingSailingCardRequests } from '@/libs/admin/cards/adminSailingCardUiQueries';
import {
  getAppRolePermissions,
  hasPermission,
  Permission,
} from '@/libs/auth/appPermissions';
import { appRoleFromSessionUser, requireAnyPermission } from '@/libs/auth/dal';
import { getCurrentSailingCardYear } from '@/libs/mit-sailing/sailingCardValidity';

type AdminCardsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: AdminCardsPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AdminCards' });
  return { title: t('meta_title') };
}

export default async function AdminCardsPage(props: AdminCardsPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const session = await requireAnyPermission(
    sailingCardReviewPermissions,
    locale
  );
  const permissions = getAppRolePermissions(
    appRoleFromSessionUser(session.user)
  );
  const cardYear = getCurrentSailingCardYear();
  const [rows, suggestedCardNumber] = await Promise.all([
    listPendingSailingCardRequests(),
    getNextAvailableSailingCardNumber({ cardYear }),
  ]);
  const t = await getTranslations({ locale, namespace: 'AdminCards' });

  return (
    <div className="flex w-full max-w-6xl flex-col gap-6">
      <AdminPageHeader title={t('title')} />
      <AdminSailingCardQueue
        canAssignCards={hasPermission(
          permissions,
          Permission.CARDS_ASSIGN_NUMBER
        )}
        canExpireCards={hasPermission(permissions, Permission.CARDS_EXPIRE)}
        locale={locale}
        rows={rows}
        suggestedCardNumber={suggestedCardNumber}
      />
    </div>
  );
}
