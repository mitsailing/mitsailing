import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminCatalogTable } from '@/components/mit-sailing/admin/catalog/AdminCatalogTable';
import {
  ADMIN_USERS_PATH,
  adminUsersNewPath,
} from '@/libs/admin/users/adminUserPaths';
import { usersAdminDefinition } from '@/libs/admin/users/userAdminDefinitions';
import { usersAdminHandlers } from '@/libs/admin/users/usersAdminHandlers';
import { requireAdmin } from '@/libs/auth/dal';
import { Link } from '@/libs/I18nNavigation';
import { getI18nPath } from '@/utils/Helpers';

type AdminUsersIndexPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: AdminUsersIndexPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'MitSailingRoutes' });
  return { title: t('meta_title_admin_users') };
}

/**
 * `GET /admin/users` — user directory with impersonation and scaffold actions.
 *
 * @param props - App Router page props
 * @returns Users table
 */
export default async function AdminUsersIndexPage(
  props: AdminUsersIndexPageProps
) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const session = await requireAdmin(locale);
  const currentUserId = session.user.id;
  const accountHref = getI18nPath('/', locale);

  const rows = await usersAdminHandlers.list();
  const tr = await getTranslations({ locale, namespace: 'AdminUsers' });
  const t = await getTranslations({ locale, namespace: 'MitSailingRoutes' });
  const ta = await getTranslations({ locale, namespace: 'AdminPage' });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-mit-text">
          {t('title_admin_users')}
        </h1>
        <div className="flex flex-wrap gap-3">
          <Link
            className="text-sm font-medium text-mit-red no-underline hover:underline"
            href="/admin/"
          >
            {tr('back_admin')}
          </Link>
          <Link
            className="rounded-md bg-mit-red px-3 py-1.5 text-sm font-semibold text-white no-underline hover:bg-mit-red-hover"
            href={adminUsersNewPath()}
          >
            {tr('action_create')}
          </Link>
        </div>
      </div>

      <AdminCatalogTable
        adminBasePath={ADMIN_USERS_PATH}
        definition={usersAdminDefinition}
        locale={locale}
        messageNamespace="AdminUsers"
        resourceId={usersAdminDefinition.id}
        rows={rows}
        userImpersonation={{
          accountRedirectHref: accountHref,
          currentUserId,
          selfLabel: ta('you'),
        }}
      />
    </div>
  );
}
