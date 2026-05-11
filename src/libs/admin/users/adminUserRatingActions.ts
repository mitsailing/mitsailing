'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@/generated/prisma/client';
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

type AdminUserRatingActionProps = {
  locale: string;
  userId: string;
};

export async function grantAdminUserRatingAction(
  props: AdminUserRatingActionProps,
  formData: FormData
): Promise<void> {
  const session = await requireAdmin(props.locale);
  const ratingId = ratingIdFromFormData(formData);
  if (!ratingId) {
    redirect(
      `${getI18nPath(adminUsersShowPath(props.userId), props.locale)}?error=invalid`
    );
  }

  const eligibility = await userCanGrantSailingRating({
    userId: props.userId,
    ratingId,
  });
  if (!eligibility?.eligible) {
    redirect(
      `${getI18nPath(adminUsersShowPath(props.userId), props.locale)}?error=${encodeURIComponent(eligibility?.reason ?? 'invalid')}`
    );
  }

  try {
    await prisma.userSailingRating.create({
      data: {
        id: randomUUID(),
        userId: props.userId,
        sailingRatingId: ratingId,
        issuedByUserId: session.user.id,
      },
    });
  } catch (error) {
    if (
      !(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
    ) {
      throw error;
    }
  }

  revalidateAfterRatingMutation(props.locale, props.userId);
  redirect(getI18nPath(adminUsersShowPath(props.userId), props.locale));
}

export async function revokeAdminUserRatingAction(
  props: AdminUserRatingActionProps,
  formData: FormData
): Promise<void> {
  await requireAdmin(props.locale);
  const ratingId = ratingIdFromFormData(formData);
  if (!ratingId) {
    redirect(
      `${getI18nPath(adminUsersShowPath(props.userId), props.locale)}?error=invalid`
    );
  }

  await prisma.userSailingRating.delete({
    where: {
      userId_sailingRatingId: {
        userId: props.userId,
        sailingRatingId: ratingId,
      },
    },
  });

  revalidateAfterRatingMutation(props.locale, props.userId);
  redirect(getI18nPath(adminUsersShowPath(props.userId), props.locale));
}
