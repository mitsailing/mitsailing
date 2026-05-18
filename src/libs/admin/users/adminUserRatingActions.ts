'use server';

import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@/generated/prisma/client';
import {
  adminUsersIndexPath,
  adminUsersShowPath,
} from '@/libs/admin/users/adminUserPaths';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import { prisma } from '@/libs/DB';
import { userCanGrantSailingRating } from '@/libs/mit-sailing/sailingRatingQueries';
import { getI18nPath } from '@/utils/Helpers';

function revalidateAfterRatingMutation(locale: string, userId: string): void {
  const userShowPath = adminUsersShowPath(userId);
  const localizedUserShowPath = getI18nPath(userShowPath, locale);
  const paths = [
    adminUsersIndexPath(),
    userShowPath,
    '/profile/ratings',
    '/ratings',
  ];
  for (const path of paths) {
    revalidatePath(path);
    revalidatePath(getI18nPath(path, locale));
  }
  revalidatePath(userShowPath, 'page');
  revalidatePath(localizedUserShowPath, 'page');
  revalidatePath(getI18nPath(adminUsersIndexPath(), locale), 'layout');
}

function ratingIdFromFormData(formData: FormData): string | null {
  const raw = formData.get('sailingRatingId');
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Serializable interactive grant tx; retry P2034 (write conflict) per Prisma
 * transaction docs. `maxWait` / `timeout` follow interactive transaction guidance.
 */
const GRANT_RATING_TX_MAX_ATTEMPTS = 5;
const GRANT_RATING_TX_BACKOFF_MS = 25;
const GRANT_RATING_TX_MAX_WAIT_MS = 5000;
const GRANT_RATING_TX_TIMEOUT_MS = 10_000;

type AdminUserRatingActionProps = {
  locale: string;
  userId: string;
};

export async function grantAdminUserRatingAction(
  props: AdminUserRatingActionProps,
  formData: FormData
): Promise<void> {
  const session = await requirePermission(
    Permission.RATINGS_ASSIGN,
    props.locale
  );
  const ratingId = ratingIdFromFormData(formData);
  if (!ratingId) {
    redirect(
      `${getI18nPath(adminUsersShowPath(props.userId), props.locale)}?error=invalid`
    );
  }

  let grantError: string | null | undefined;
  for (let attempt = 0; attempt < GRANT_RATING_TX_MAX_ATTEMPTS; attempt += 1) {
    try {
      grantError = await prisma.$transaction(
        async (tx) => {
          const eligibility = await userCanGrantSailingRating(
            {
              userId: props.userId,
              ratingId,
            },
            { client: tx }
          );
          if (!eligibility?.eligible) {
            return eligibility?.reason ?? 'invalid';
          }

          try {
            await tx.userSailingRating.create({
              data: {
                id: randomUUID(),
                userId: props.userId,
                sailingRatingId: ratingId,
                issuedByUserId: session.user.id,
              },
            });
          } catch (error) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2002'
            ) {
              return null;
            }
            throw error;
          }

          return null;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: GRANT_RATING_TX_MAX_WAIT_MS,
          timeout: GRANT_RATING_TX_TIMEOUT_MS,
        }
      );
      break;
    } catch (error: unknown) {
      const isWriteConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034';
      if (!isWriteConflict) {
        throw error;
      }
      if (attempt === GRANT_RATING_TX_MAX_ATTEMPTS - 1) {
        grantError = 'conflict';
        break;
      }
      await sleep(GRANT_RATING_TX_BACKOFF_MS * 2 ** attempt);
    }
  }

  if (grantError === undefined) {
    throw new Error('grant rating transaction did not complete');
  }

  if (grantError) {
    redirect(
      `${getI18nPath(adminUsersShowPath(props.userId), props.locale)}?error=${encodeURIComponent(grantError)}`
    );
  }

  revalidateAfterRatingMutation(props.locale, props.userId);
  redirect(getI18nPath(adminUsersShowPath(props.userId), props.locale));
}

export async function revokeAdminUserRatingAction(
  props: AdminUserRatingActionProps,
  formData: FormData
): Promise<void> {
  await requirePermission(Permission.RATINGS_ASSIGN, props.locale);
  const ratingId = ratingIdFromFormData(formData);
  if (!ratingId) {
    redirect(
      `${getI18nPath(adminUsersShowPath(props.userId), props.locale)}?error=invalid`
    );
  }

  await prisma.userSailingRating.deleteMany({
    where: {
      userId: props.userId,
      sailingRatingId: ratingId,
    },
  });

  revalidateAfterRatingMutation(props.locale, props.userId);
  redirect(getI18nPath(adminUsersShowPath(props.userId), props.locale));
}
