import 'server-only';
import { updateTag } from 'next/cache';

const ROLE_PERMISSION_GRANTS_CACHE_TAG = 'role-permission-grants';

export function invalidateRolePermissionGrants(): void {
  updateTag(ROLE_PERMISSION_GRANTS_CACHE_TAG);
}
