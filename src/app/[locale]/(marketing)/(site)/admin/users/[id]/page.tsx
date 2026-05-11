import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { AdminPrimaryActionLink } from '@/components/mit-sailing/admin/AdminPrimaryActionLink';
import { AdminUserRatingsPanel } from '@/components/mit-sailing/admin/users/AdminUserRatingsPanel';
import { adminUsersEditPath } from '@/libs/admin/users/adminUserPaths';
import { usersAdminHandlers } from '@/libs/admin/users/usersAdminHandlers';
import { requireAdmin } from '@/libs/auth/dal';
import { logger } from '@/libs/Logger';
import { listUserRatingAssignmentRows } from '@/libs/mit-sailing/sailingRatingQueries';
import type { UserRatingAssignmentRow } from '@/libs/mit-sailing/sailingRatingQueries';

type AdminUserShowPageProps = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export async function generateMetadata(
  props: AdminUserShowPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'MitSailingRoutes' });
  return { title: t('meta_title_admin_users_show') };
}

export default async function AdminUserShowPage(props: AdminUserShowPageProps) {
  const { locale, id } = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(locale);
  await requireAdmin(locale);

  const user = await usersAdminHandlers.getById(id);
  if (!user) {
    notFound();
  }
  let rows: UserRatingAssignmentRow[] = [];
  try {
    rows = await listUserRatingAssignmentRows(id);
  } catch (error) {
    logger.error('Failed to load admin user rating rows: {error}', {
      error,
      userId: id,
    });
  }
  const t = await getTranslations({ locale, namespace: 'AdminUsers' });

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <AdminPageHeader
        actions={
          <AdminPrimaryActionLink href={adminUsersEditPath(id)}>
            {t('action_edit')}
          </AdminPrimaryActionLink>
        }
        title={user.name}
      />
      <div className="rounded-lg border border-border bg-card p-5 text-sm text-foreground">
        <dl className="m-0 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="font-semibold">{t('column_email')}</dt>
            <dd className="m-0">{user.email}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t('column_role')}</dt>
            <dd className="m-0">{user.role}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t('column_email_verified')}</dt>
            <dd className="m-0">
              {user.emailVerified ? t('boolean_yes') : t('boolean_no')}
            </dd>
          </div>
        </dl>
      </div>
      <AdminUserRatingsPanel
        errorCode={searchParams.error}
        locale={locale}
        rows={rows}
        userId={id}
      />
    </div>
  );
}
