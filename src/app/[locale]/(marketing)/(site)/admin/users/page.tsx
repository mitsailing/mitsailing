import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { AdminPrimaryActionLink } from '@/components/mit-sailing/admin/AdminPrimaryActionLink';
import { AdminCatalogTable } from '@/components/mit-sailing/admin/catalog/AdminCatalogTable';
import {
  ADMIN_USERS_PATH,
  adminUsersNewPath,
} from '@/libs/admin/users/adminUserPaths';
import { usersAdminDefinition } from '@/libs/admin/users/userAdminDefinitions';
import { usersAdminHandlers } from '@/libs/admin/users/usersAdminHandlers';
import { appRoleFromSessionUser, requirePermission } from '@/libs/auth/dal';
import {
  AuthSubject,
  createAuthAbility,
  Permission,
} from '@/libs/auth/permissions';
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

  const session = await requirePermission(Permission.USERS_VIEW, locale);
  const currentUserId = session.user.id;
  const currentUserRole = appRoleFromSessionUser(session.user);
  const ability = createAuthAbility({
    grants: [],
    role: currentUserRole,
    userId: currentUserId,
  });
  const canEditUsers = ability.can(
    Permission.USERS_EDIT,
    AuthSubject.PERMISSION
  );
  const canDeleteUsers = ability.can(
    Permission.USERS_DELETE,
    AuthSubject.PERMISSION
  );
  const accountHref = getI18nPath('/', locale);

  const rows = await usersAdminHandlers.list();
  const tr = await getTranslations({ locale, namespace: 'AdminUsers' });
  const t = await getTranslations({ locale, namespace: 'MitSailingRoutes' });
  const ta = await getTranslations({ locale, namespace: 'AdminPage' });

  return (
    <div className="flex w-full flex-col gap-6">
      <AdminPageHeader
        actions={
          canEditUsers ? (
            <AdminPrimaryActionLink href={adminUsersNewPath()}>
              {tr('action_create')}
            </AdminPrimaryActionLink>
          ) : undefined
        }
        title={t('title_admin_users')}
      />

      <AdminCatalogTable
        adminBasePath={ADMIN_USERS_PATH}
        definition={{
          ...usersAdminDefinition,
          capabilities: {
            create: canEditUsers,
            delete: canDeleteUsers,
            reorder: false,
            update: canEditUsers,
          },
        }}
        locale={locale}
        messageNamespace="AdminUsers"
        resourceId={usersAdminDefinition.id}
        rows={rows}
        userImpersonation={
          canEditUsers
            ? {
                accountRedirectHref: accountHref,
                currentUserId,
                selfLabel: ta('you'),
              }
            : undefined
        }
      />
    </div>
  );
}
