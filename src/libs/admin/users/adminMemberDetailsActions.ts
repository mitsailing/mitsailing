'use server';

import { revalidatePath } from 'next/cache';
import { adminUsersShowPath } from '@/libs/admin/users/adminUserPaths';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import {
  profileContactForInput,
  saveProfileDetailsForUser,
  validateProfileIdentity,
} from '@/libs/auth/profileIdentityActions';
import type {
  ProfileDetailsInput,
  UpdateProfileDetailsResult,
} from '@/libs/auth/profileIdentityActions';
import { getI18nPath } from '@/utils/Helpers';

/**
 * Updates another member's profile details from the admin account tab.
 *
 * @param locale - Active locale for cache revalidation
 * @param userId - Target member id
 * @param input - Profile identity and contact fields
 * @returns Validation and persistence result
 */
export async function updateAdminMemberDetailsAction(
  locale: string,
  userId: string,
  input: ProfileDetailsInput
): Promise<UpdateProfileDetailsResult> {
  await requirePermission(Permission.USERS_EDIT, locale);

  const contactResult = profileContactForInput(input);
  if (!contactResult.ok) {
    return contactResult;
  }

  const identityResult = await validateProfileIdentity({
    input,
    userId,
  });
  if (!identityResult.ok) {
    return identityResult;
  }

  const saveError = await saveProfileDetailsForUser({
    contact: contactResult.contact,
    identity: identityResult.identity,
    userId: identityResult.userId,
  });
  if (saveError) {
    return saveError;
  }

  revalidatePath(getI18nPath(adminUsersShowPath(userId), locale));
  return { identity: identityResult.identity, ok: true };
}
