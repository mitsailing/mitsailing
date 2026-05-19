import 'server-only';
import { redirect } from 'next/navigation';
import type { AdminNavItem } from '@/libs/admin/adminNavigation';
import { adminNavItemsForPermissions } from '@/libs/admin/adminNavigation';
import {
  getAppRolePermissions,
  hasPermission,
  Permission,
} from '@/libs/auth/appPermissions';
import type { AuthSession } from '@/libs/auth/dal';
import { verifySession } from '@/libs/auth/dal';
import type { Role } from '@/libs/auth/roles';
import type { AppAuthContext } from '@/libs/zenstack/authContext';
import { appAuthContextFromSession } from '@/libs/zenstack/authContext';
import { getI18nPath } from '@/utils/Helpers';

export type AdminAreaAccess = {
  authContext: AppAuthContext;
  navItems: AdminNavItem[];
  permissions: readonly Permission[];
  appRole: Role;
  session: NonNullable<AuthSession>;
};

export async function requireAdminAreaAccess(
  locale: string
): Promise<AdminAreaAccess> {
  const homeHref = getI18nPath('/', locale);
  const session = await verifySession(locale, homeHref);
  const authContext = appAuthContextFromSession(session);
  if (!authContext) {
    return redirect(homeHref);
  }

  const permissions = getAppRolePermissions(authContext.appRole);
  if (!hasPermission(permissions, Permission.ADMIN_VIEW)) {
    return redirect(homeHref);
  }

  return {
    appRole: authContext.appRole,
    authContext,
    navItems: adminNavItemsForPermissions(permissions),
    permissions,
    session,
  };
}
