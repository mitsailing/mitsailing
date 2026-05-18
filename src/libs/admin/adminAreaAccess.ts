import 'server-only';
import { redirect } from 'next/navigation';
import type { AdminNavItem } from '@/libs/admin/adminNavigation';
import { adminNavItemsForAbility } from '@/libs/admin/adminNavigation';
import type { AuthSession } from '@/libs/auth/dal';
import { verifySession } from '@/libs/auth/dal';
import type { AuthAbility } from '@/libs/auth/permissions';
import {
  AuthSubject,
  createAuthAbility,
  Permission,
} from '@/libs/auth/permissions';
import { listRolePermissionGrants } from '@/libs/auth/rolePermissionGrants';
import { normalizeRole, parseRoles, Role } from '@/libs/auth/roles';
import { getI18nPath } from '@/utils/Helpers';

export type AdminAreaAccess = {
  ability: AuthAbility;
  navItems: AdminNavItem[];
  role: Role;
  session: NonNullable<AuthSession>;
};

export async function requireAdminAreaAccess(
  locale: string
): Promise<AdminAreaAccess> {
  const homeHref = getI18nPath('/', locale);
  const session = await verifySession(locale, homeHref);
  if (session.session.impersonatedBy) {
    redirect(homeHref);
  }

  const roles = parseRoles(session.user.role);
  const role = normalizeRole(session.user.role);
  const grants = roles.includes(Role.ADMIN)
    ? []
    : await listRolePermissionGrants();
  const ability = createAuthAbility({
    grants,
    roles,
    userId: session.user.id,
  });
  if (!ability.can(Permission.ADMIN_VIEW, AuthSubject.PERMISSION)) {
    redirect(homeHref);
  }

  return {
    ability,
    navItems: adminNavItemsForAbility(ability),
    role,
    session,
  };
}
