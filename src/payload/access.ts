import type { Access, AccessArgs, Where } from 'payload';
import {
  getAppRolePermissions,
  hasAnyPermission,
  hasPermission,
  normalizeAppRole,
  Permission,
} from '@/libs/auth/appPermissions';
import type { Role } from '@/libs/auth/roles';

export const CMS_ADMIN_PERMISSIONS = [
  Permission.CMS_EDIT,
  Permission.FLEET_MANAGE,
  Permission.SAILING_CLASSES_MANAGE,
] as const;

type PayloadStaffUser = {
  appRole?: unknown;
};

function appRoleFromUser(user: unknown): Role {
  if (typeof user !== 'object' || user === null) {
    return normalizeAppRole(null);
  }
  return normalizeAppRole((user as PayloadStaffUser).appRole);
}

function permissionsForUser(user: unknown) {
  return getAppRolePermissions(appRoleFromUser(user));
}

function canAccessCmsAdmin(user: unknown): boolean {
  return hasAnyPermission(permissionsForUser(user), CMS_ADMIN_PERMISSIONS);
}

/**
 * Staff with any CMS admin permission may read; anonymous callers get the
 * provided published/visible constraint (or open read when constraint is true).
 *
 * @param anonymousConstraint - Published-only filter for anonymous reads
 * @returns Payload read access policy
 */
function publicOrStaffReadAccess(anonymousConstraint: Where | true): Access {
  return ({ req }: AccessArgs) => {
    if (req.user && canAccessCmsAdmin(req.user)) {
      return true;
    }
    return anonymousConstraint;
  };
}

export const authenticatedCmsAccess: Access = ({ req }: AccessArgs) =>
  Boolean(req.user) && canAccessCmsAdmin(req.user);

export const cmsEditAccess: Access = ({ req }: AccessArgs) =>
  hasPermission(permissionsForUser(req.user), Permission.CMS_EDIT);

export const fleetManageAccess: Access = ({ req }: AccessArgs) =>
  hasPermission(permissionsForUser(req.user), Permission.FLEET_MANAGE);

export const sailingClassesManageAccess: Access = ({ req }: AccessArgs) =>
  hasPermission(
    permissionsForUser(req.user),
    Permission.SAILING_CLASSES_MANAGE
  );

/** Anonymous: published pages only. Staff: all including drafts. */
export const publishedPagesReadAccess: Access = publicOrStaffReadAccess({
  _status: { equals: 'published' },
});

/** Anonymous: visible catalog rows. Staff: all including hidden. */
export const visibleCatalogReadAccess: Access = publicOrStaffReadAccess({
  isVisible: { equals: true },
});

/** Anonymous and staff may read published chrome menus. */
export const publicMenusReadAccess: Access = publicOrStaffReadAccess(true);
