import { buildAdminListHref } from '@/libs/admin/buildAdminListHref';
import { adminUsersShowPath } from '@/libs/admin/users/adminUserPaths';

export type AdminUserAccountTab = 'account' | 'admin' | 'emails' | 'payments';

const adminUserAccountDefaultTab =
  'account' as const satisfies AdminUserAccountTab;

/**
 * Parses the active member account tab from URL search params.
 *
 * @param value - Raw `tab` search param
 * @returns Normalized tab id
 */
export function parseAdminUserAccountTab(
  value?: string | string[]
): AdminUserAccountTab {
  const selected = Array.isArray(value) ? value.at(0)?.trim() : value?.trim();
  if (
    selected === 'payments' ||
    selected === 'emails' ||
    selected === 'admin'
  ) {
    return selected;
  }
  return adminUserAccountDefaultTab;
}

/**
 * Builds a member account URL with an optional tab selected.
 *
 * @param id - User id
 * @param tab - Tab to open
 * @returns Account page path with query string when needed
 */
export function adminUsersAccountTabPath(
  id: string,
  tab: AdminUserAccountTab = adminUserAccountDefaultTab
) {
  return buildAdminListHref({
    omitWhenDefault: { tab: adminUserAccountDefaultTab },
    params: {},
    pathname: adminUsersShowPath(id),
    resetPage: false,
    updates: tab === adminUserAccountDefaultTab ? {} : { tab },
  });
}
