import { adminUsersAccountTabPath } from '@/libs/admin/users/adminUserAccountTab';

export const ADMIN_USERS_PATH = '/admin/users';

/**
 * @returns Path to the users admin index (`/admin/users`)
 */
export function adminUsersIndexPath(): string {
  return ADMIN_USERS_PATH;
}

/**
 * @returns Path to new-user form
 */
export function adminUsersNewPath(): string {
  return `${ADMIN_USERS_PATH}/new`;
}

/**
 * @param id - User id
 * @returns Path to user show page
 */
export function adminUsersShowPath(id: string): string {
  return `${ADMIN_USERS_PATH}/${encodeURIComponent(id)}`;
}

/**
 * @param id - User id
 * @returns Path to member account admin tab
 */
export function adminUsersEditPath(id: string): string {
  return adminUsersAccountTabPath(id, 'admin');
}

/**
 * @param id - User id
 * @returns Path to delete confirmation
 */
export function adminUsersDeletePath(id: string): string {
  return `${ADMIN_USERS_PATH}/${encodeURIComponent(id)}/delete`;
}
