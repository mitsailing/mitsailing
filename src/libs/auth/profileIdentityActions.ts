'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/libs/auth/dal';
import {
  profileContactForInput,
  saveProfileDetailsForUser,
  validateProfileIdentity,
} from '@/libs/auth/profileIdentityPersistence';
import type {
  ProfileDetailsInput,
  UpdateProfileDetailsResult,
  UpdateProfileIdentityResult,
} from '@/libs/auth/profileIdentityPersistence';
import { getI18nPath } from '@/utils/Helpers';

export type {
  ProfileDetailsInput,
  UpdateProfileDetailsResult,
  UpdateProfileIdentityResult,
} from '@/libs/auth/profileIdentityPersistence';

async function currentProfileIdentityUserId(): Promise<
  | { ok: true; userId: string }
  | Exclude<UpdateProfileIdentityResult, { ok: true }>
> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: 'unauthorized' };
  }
  return { ok: true, userId: session.user.id };
}

/**
 * Updates the signed-in member's identity fields.
 *
 * @param locale - Active locale for cache revalidation
 * @param input - Affiliation and name/MIT ID fields
 * @returns Validation and persistence result
 */
export async function updateProfileIdentityAction(
  locale: string,
  input: Pick<
    ProfileDetailsInput,
    'affiliation' | 'firstName' | 'lastName' | 'mitId'
  >
): Promise<UpdateProfileIdentityResult> {
  const sessionResult = await currentProfileIdentityUserId();
  if (!sessionResult.ok) {
    return sessionResult;
  }
  const identityResult = await validateProfileIdentity({
    input,
    userId: sessionResult.userId,
  });
  if (!identityResult.ok) {
    return identityResult;
  }

  const saveError = await saveProfileDetailsForUser({
    identity: identityResult.identity,
    userId: identityResult.userId,
  });
  if (saveError) {
    return saveError;
  }

  revalidatePath(getI18nPath('/profile', locale));
  return { identity: identityResult.identity, ok: true };
}

/**
 * Updates the signed-in member's identity and contact fields.
 *
 * @param locale - Active locale for cache revalidation
 * @param input - Profile identity and contact fields
 * @returns Validation and persistence result
 */
export async function updateProfileDetailsAction(
  locale: string,
  input: ProfileDetailsInput
): Promise<UpdateProfileDetailsResult> {
  const sessionResult = await currentProfileIdentityUserId();
  if (!sessionResult.ok) {
    return sessionResult;
  }

  const contactResult = profileContactForInput(input);
  if (!contactResult.ok) {
    return contactResult;
  }

  const identityResult = await validateProfileIdentity({
    input,
    userId: sessionResult.userId,
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

  revalidatePath(getI18nPath('/profile', locale));
  return { identity: identityResult.identity, ok: true };
}
