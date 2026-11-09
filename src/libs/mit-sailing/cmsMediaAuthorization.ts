import {
  getAppRolePermissions,
  hasPermission,
  Permission,
} from '@/libs/auth/appPermissions';
import { getCurrentUser } from '@/libs/auth/dal';

export type CmsMediaAuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Authorizes shared CMS media library access for admin-area users.
 *
 * @returns Auth success with user id, or 401/403 failure.
 */
export async function authorizeCmsMediaLibraryAccess(): Promise<CmsMediaAuthResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { ok: false, status: 401, error: 'unauthorized' };
  }
  const permissions = getAppRolePermissions(currentUser.role);
  if (!hasPermission(permissions, Permission.ADMIN_VIEW)) {
    return { ok: false, status: 403, error: 'forbidden' };
  }
  return { ok: true, userId: currentUser.id };
}
