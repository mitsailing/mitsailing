import type { PrismaClient } from '@/generated/prisma/client';

type DraftDb = Pick<PrismaClient, 'pavilionReservationRequest'>;

/**
 * Hard-deletes other incomplete drafts for the same guest and event.
 *
 * @param db - Prisma client or transaction
 * @param props - Winning row and match keys
 * @returns Deleted draft request ids
 */
export async function deleteSupersededPavilionReservationDrafts(
  db: DraftDb,
  props: {
    eventName: string;
    keepRequestId: string;
    requesterEmail: string;
  }
): Promise<string[]> {
  const trimmedEventName = props.eventName.trim();
  if (!trimmedEventName) {
    return [];
  }

  const superseded = await db.pavilionReservationRequest.findMany({
    select: { id: true },
    where: {
      eventName: { equals: trimmedEventName, mode: 'insensitive' },
      id: { not: props.keepRequestId },
      requesterEmail: props.requesterEmail,
      status: 'draft',
    },
  });
  if (superseded.length === 0) {
    return [];
  }

  const deletedIds = superseded.map((row) => row.id);
  await db.pavilionReservationRequest.deleteMany({
    where: { id: { in: deletedIds } },
  });
  return deletedIds;
}

/**
 * Loads a draft row by resume token for public upsert/submit auth.
 *
 * @param db - Prisma client or transaction
 * @param resumeToken - Opaque resume token
 * @returns Draft row or null when missing/not draft
 */
export async function findPavilionReservationDraftByResumeTokenRow(
  db: DraftDb,
  resumeToken: string
): Promise<{
  id: string;
  referenceCode: string;
  requesterEmail: string;
  resumeToken: string | null;
  status: string;
} | null> {
  const trimmed = resumeToken.trim();
  if (!trimmed) {
    return null;
  }

  const row = await db.pavilionReservationRequest.findFirst({
    select: {
      id: true,
      referenceCode: true,
      requesterEmail: true,
      resumeToken: true,
      status: true,
    },
    where: { resumeToken: trimmed, status: 'draft' },
  });
  return row;
}
