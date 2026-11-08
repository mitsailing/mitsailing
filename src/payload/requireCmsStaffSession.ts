import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/libs/auth';
import {
  getAppRolePermissions,
  hasAnyPermission,
  normalizeAppRole,
} from '@/libs/auth/appPermissions';
import { authHrefWithCallback } from '@/libs/auth/callbackUrl';
import { CMS_ADMIN_PERMISSIONS } from '@/payload/access';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Redirects unauthenticated users and sailors without CMS staff permissions to
 * `/login`. Staff with `cms.edit`, `fleet.manage`, or `sailingClasses.manage`
 * continue into Payload admin.
 */
export async function requireCmsStaffSession(): Promise<void> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const appRole = normalizeAppRole(
    isRecord(session?.user) ? session.user.appRole : null
  );
  const permissions = getAppRolePermissions(appRole);

  if (!session || !hasAnyPermission(permissions, CMS_ADMIN_PERMISSIONS)) {
    redirect(authHrefWithCallback('/login', '/cms'));
  }
}
