'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminFormReturnsToEdit } from '@/libs/admin/adminFormRedirect';
import { ADMIN_INDEX_PATH } from '@/libs/admin/catalog/adminCatalogPaths';
import {
  adminUsersDeletePath,
  adminUsersEditPath,
  adminUsersIndexPath,
  adminUsersNewPath,
  adminUsersShowPath,
} from '@/libs/admin/users/adminUserPaths';
import { usersAdminHandlers } from '@/libs/admin/users/usersAdminHandlers';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import { getI18nPath } from '@/utils/Helpers';

function revalidateAfterUserMutation(locale: string): void {
  revalidatePath(getI18nPath(adminUsersIndexPath(), locale), 'layout');
  revalidatePath(getI18nPath(ADMIN_INDEX_PATH, locale));
}

function revalidateAfterUserUpdate(locale: string, userId: string): void {
  revalidateAfterUserMutation(locale);
  revalidatePath(getI18nPath(adminUsersEditPath(userId), locale));
  revalidatePath(getI18nPath(adminUsersShowPath(userId), locale));
}

/**
 * Persists a new user via Better Auth admin API.
 *
 * @param locale - Active locale for redirects
 * @param formData - Raw multipart form body
 */
export async function createAdminUserAction(
  locale: string,
  formData: FormData
): Promise<void> {
  await requirePermission(Permission.USERS_EDIT, locale);
  const result = await usersAdminHandlers.createFromForm(formData);
  if (!result.ok) {
    redirect(
      `${getI18nPath(adminUsersNewPath(), locale)}?error=${encodeURIComponent(result.code)}`
    );
  }
  revalidateAfterUserMutation(locale);
  redirect(getI18nPath(adminUsersIndexPath(), locale));
}

/**
 * Updates an existing user via Better Auth admin API.
 *
 * @param locale - Active locale
 * @param userId - Target user id
 * @param formData - Raw multipart form body
 */
export async function updateAdminUserAction(
  locale: string,
  userId: string,
  formData: FormData
): Promise<void> {
  await requirePermission(Permission.USERS_EDIT, locale);
  const result = await usersAdminHandlers.updateFromForm(userId, formData);
  if (!result.ok) {
    redirect(
      `${getI18nPath(adminUsersEditPath(userId), locale)}?error=${encodeURIComponent(result.code)}`
    );
  }
  revalidateAfterUserUpdate(locale, userId);
  const path = adminFormReturnsToEdit(formData)
    ? adminUsersEditPath(userId)
    : adminUsersShowPath(userId);
  redirect(getI18nPath(path, locale));
}

/**
 * Deletes a user after confirmation (Better Auth removeUser).
 *
 * @param locale - Active locale
 * @param userId - Target user id
 */
export async function deleteAdminUserAction(
  locale: string,
  userId: string
): Promise<void> {
  await requirePermission(Permission.USERS_DELETE, locale);
  const result = await usersAdminHandlers.delete(userId);
  if (!result.ok) {
    redirect(
      `${getI18nPath(adminUsersDeletePath(userId), locale)}?error=${encodeURIComponent(result.code)}`
    );
  }
  revalidateAfterUserMutation(locale);
  redirect(getI18nPath(adminUsersIndexPath(), locale));
}
