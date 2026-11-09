import {
  getAppRolePermissions,
  hasAnyPermission,
  normalizeAppRole,
} from '@/libs/auth/appPermissions';
import { CMS_ADMIN_PERMISSIONS } from '@/payload/access';

function appRoleFromUser(user: unknown) {
  if (typeof user !== 'object' || user === null || !('appRole' in user)) {
    return normalizeAppRole(null);
  }
  return normalizeAppRole(user.appRole);
}

/**
 * Whether this session may read unpublished page drafts.
 *
 * @param user - Better Auth session user
 * @returns True for staff who can open the CMS admin
 */
export function sessionCanPreviewCmsDrafts(user: unknown): boolean {
  return hasAnyPermission(
    getAppRolePermissions(appRoleFromUser(user)),
    CMS_ADMIN_PERMISSIONS
  );
}
