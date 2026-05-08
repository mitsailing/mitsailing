'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  adminUsersIndexPath,
  adminUsersShowPath,
} from '@/libs/admin/users/adminUserPaths';
import { requireAdmin } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { userCanGrantSailingRating } from '@/libs/mit-sailing/sailingRatingQueries';
import { getI18nPath } from '@/utils/Helpers';

function revalidateAfterRatingMutation(locale: string, userId: string): void {
  revalidatePath(getI18nPath(adminUsersIndexPath(), locale), 'layout');
  revalidatePath(getI18nPath(adminUsersShowPath(userId), locale));
  revalidatePath(getI18nPath('/profile/ratings/', locale));
  revalidatePath(getI18nPath('/ratings/', locale));
}

function ratingIdFromFormData(formData: FormData): string | null {
  const raw = formData.get('sailingRatingId');
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function grantAdminUserRatingAction(
  locale: string,
  userId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAdmin(locale);
  const ratingId = ratingIdFromFormData(formData);
  if (!ratingId) {
    redirect(
      `${getI18nPath(adminUsersShowPath(userId), locale)}?error=invalid`
    );
  }

  const eligibility = await userCanGrantSailingRating({
    userId,
    ratingId,
  });
  if (!eligibility?.eligible) {
    redirect(
      `${getI18nPath(adminUsersShowPath(userId), locale)}?error=${encodeURIComponent(eligibility?.reason ?? 'invalid')}`
    );
  }

  await prisma.userSailingRating.create({
    data: {
      id: randomUUID(),
      userId,
      sailingRatingId: ratingId,
      issuedByUserId: session.user.id,
    },
  });

  revalidateAfterRatingMutation(locale, userId);
  redirect(getI18nPath(adminUsersShowPath(userId), locale));
}

export async function revokeAdminUserRatingAction(
  locale: string,
  userId: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const ratingId = ratingIdFromFormData(formData);
  if (!ratingId) {
    redirect(
      `${getI18nPath(adminUsersShowPath(userId), locale)}?error=invalid`
    );
  }

  await prisma.userSailingRating.delete({
    where: { userId_sailingRatingId: { userId, sailingRatingId: ratingId } },
  });

  revalidateAfterRatingMutation(locale, userId);
  redirect(getI18nPath(adminUsersShowPath(userId), locale));
}
