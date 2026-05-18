import 'server-only';
import { unstable_cache, updateTag } from 'next/cache';
import type { RolePermissionGrant } from '@/libs/auth/permissions';
import { normalizeRolePermissionGrant } from '@/libs/auth/permissions';
import { prisma } from '@/libs/DB';

const ROLE_PERMISSION_GRANTS_CACHE_TAG = 'role-permission-grants';

export const listRolePermissionGrants = unstable_cache(
  async (): Promise<RolePermissionGrant[]> => {
    const rows = await prisma.rolePermissionGrant.findMany({
      select: {
        permissionKey: true,
        roleKey: true,
      },
    });
    return rows.flatMap((row) => {
      const grant = normalizeRolePermissionGrant(row);
      return grant ? [grant] : [];
    });
  },
  ['role-permission-grants'],
  { tags: [ROLE_PERMISSION_GRANTS_CACHE_TAG] }
);

export function invalidateRolePermissionGrants(): void {
  updateTag(ROLE_PERMISSION_GRANTS_CACHE_TAG);
}
