import type { Access, AccessArgs } from 'payload';
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
