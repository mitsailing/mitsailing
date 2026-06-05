'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@/generated/prisma/client';
import { LearnToSailWaitlistEntryStatus } from '@/generated/prisma/enums';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import {
  activeLearnToSailWaitlistEntryKey,
  getLearnToSailSeasonYear,
  isLearnToSailWaitlistOpen,
} from '@/libs/mit-sailing/learnToSailWaitlist';

const learnToSailWaitlistLockNamespace = 20_260_604;

/**
 * Joins the viewer to the current annual Learn-to-Sail waitlist.
 *
 * @param locale - Active locale segment.
 * @param callbackPath - App-owned path to return to after joining.
 */
export async function joinLearnToSailWaitlistAction(
  locale: string,
  callbackPath: string
): Promise<void> {
  const now = new Date();
  const user = await requireCurrentUser(locale, callbackPath);
  if (!isLearnToSailWaitlistOpen(now)) {
    redirect(`${callbackPath}?waitlist=not_open`);
  }
  const seasonYear = getLearnToSailSeasonYear(now);
  const activeEntryKey = activeLearnToSailWaitlistEntryKey({
    seasonYear,
    userId: user.id,
  });

  await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(${learnToSailWaitlistLockNamespace}, ${seasonYear})
      `;
      const existing = await tx.learnToSailWaitlistEntry.findUnique({
        select: { id: true },
        where: { activeEntryKey },
      });
      if (existing) {
        return;
      }
      const currentMax = await tx.learnToSailWaitlistEntry.aggregate({
        _max: { sequence: true },
        where: { seasonYear },
      });
      await tx.learnToSailWaitlistEntry.create({
        data: {
          activeEntryKey,
          id: randomUUID(),
          joinedAt: now,
          seasonYear,
          sequence: (currentMax._max.sequence ?? 0) + 1,
          status: LearnToSailWaitlistEntryStatus.active,
          userId: user.id,
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10_000,
    }
  );

  revalidatePath(callbackPath);
  redirect(callbackPath);
}
