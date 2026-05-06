'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ADMIN_INDEX_PATH } from '@/libs/admin/catalog/adminCatalogPaths';
import {
  adminUsersDeletePath,
  adminUsersEditPath,
  adminUsersIndexPath,
  adminUsersNewPath,
} from '@/libs/admin/users/adminUserPaths';
import { usersAdminHandlers } from '@/libs/admin/users/usersAdminHandlers';
import { requireAdmin } from '@/libs/auth/dal';
import { getI18nPath } from '@/utils/Helpers';

function revalidateAfterUserMutation(locale: string): void {
  revalidatePath(getI18nPath(adminUsersIndexPath(), locale), 'layout');
  revalidatePath(getI18nPath(ADMIN_INDEX_PATH, locale));
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
  const session = await requireAdmin(locale);
  const result = await usersAdminHandlers.createFromForm(formData, {
    userId: session.user.id,
  });
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
  const session = await requireAdmin(locale);
  const result = await usersAdminHandlers.updateFromForm(userId, formData, {
    userId: session.user.id,
  });
  if (!result.ok) {
    redirect(
      `${getI18nPath(adminUsersEditPath(userId), locale)}?error=${encodeURIComponent(result.code)}`
    );
  }
  revalidateAfterUserMutation(locale);
  revalidatePath(getI18nPath(adminUsersEditPath(userId), locale));
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
  await requireAdmin(locale);
  const result = await usersAdminHandlers.delete(userId);
  if (!result.ok) {
    redirect(
      `${getI18nPath(adminUsersDeletePath(userId), locale)}?error=${encodeURIComponent(result.code)}`
    );
  }
  revalidateAfterUserMutation(locale);
  redirect(getI18nPath(adminUsersIndexPath(), locale));
}
