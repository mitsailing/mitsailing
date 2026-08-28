import type { JobsOptions, Queue } from 'bullmq';
import * as z from 'zod';
import { prisma } from '@/libs/DB';
import { sendPavilionReservationAbandonEmail } from '@/libs/email/pavilion-reservation-emails';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';

export const PAVILION_RESERVATION_ABANDON_EMAIL_JOB_NAME =
  'pavilion-reservation-abandon-email';

export const PAVILION_RESERVATION_ABANDON_EMAIL_DELAY_MS = 3_600_000;

const pavilionReservationAbandonEmailJobDataSchema = z.object({
  requestId: z.string().min(1),
});

const PAVILION_RESERVATION_ABANDON_EMAIL_JOB_OPTS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 60_000 },
  delay: PAVILION_RESERVATION_ABANDON_EMAIL_DELAY_MS,
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
};

const abandonEmailReservationSelect = {
  abandonEmailSentAt: true,
  eventName: true,
  referenceCode: true,
  requesterEmail: true,
  resumeToken: true,
  status: true,
} as const;

type AbandonEmailReservation = {
  abandonEmailSentAt: Date | null;
  eventName: string;
  referenceCode: string;
  requesterEmail: string;
  resumeToken: string | null;
  status: string;
};

export type PavilionReservationAbandonEmailJobData = z.infer<
  typeof pavilionReservationAbandonEmailJobDataSchema
>;

export type PavilionReservationAbandonEmailQueue = Pick<
  Queue<PavilionReservationAbandonEmailJobData>,
  'add' | 'getJob'
>;

function abandonEmailJobId(requestId: string): string {
  return `${PAVILION_RESERVATION_ABANDON_EMAIL_JOB_NAME}-${requestId}`;
}

function pavilionReservationResumeUrl(resumeToken: string): string {
  return `${Env.NEXT_PUBLIC_APP_URL}/reserve?resume=${encodeURIComponent(resumeToken)}`;
}

function isEligibleForAbandonEmail(
  reservation: AbandonEmailReservation
): reservation is AbandonEmailReservation & { resumeToken: string } {
  return (
    reservation.status === 'draft' &&
    reservation.abandonEmailSentAt === null &&
    reservation.resumeToken !== null &&
    reservation.resumeToken !== ''
  );
}

function canSendAbandonEmailAfterClaim(
  reservation: AbandonEmailReservation
): reservation is AbandonEmailReservation & { resumeToken: string } {
  return (
    reservation.status === 'draft' &&
    reservation.resumeToken !== null &&
    reservation.resumeToken !== ''
  );
}

async function claimAbandonEmailSend(requestId: string): Promise<boolean> {
  const claim = await prisma.pavilionReservationRequest.updateMany({
    data: { abandonEmailSentAt: new Date() },
    where: {
      abandonEmailSentAt: null,
      id: requestId,
      resumeToken: { not: null },
      status: 'draft',
    },
  });
  return claim.count > 0;
}

async function rollbackAbandonEmailClaim(requestId: string): Promise<void> {
  await prisma.pavilionReservationRequest.updateMany({
    data: { abandonEmailSentAt: null },
    where: {
      abandonEmailSentAt: { not: null },
      id: requestId,
      status: 'draft',
    },
  });
}

async function sendClaimedAbandonEmail(
  reservation: AbandonEmailReservation & { resumeToken: string },
  requestId: string
): Promise<void> {
  try {
    await sendPavilionReservationAbandonEmail({
      eventName: reservation.eventName,
      referenceCode: reservation.referenceCode,
      requesterEmail: reservation.requesterEmail,
      resumeUrl: pavilionReservationResumeUrl(reservation.resumeToken),
    });
  } catch (error) {
    await rollbackAbandonEmailClaim(requestId);
    throw error;
  }
}

/**
 * Removes queued abandon-email jobs for the given draft request ids.
 *
 * @param queue - Default BullMQ queue
 * @param requestIds - Draft request ids to cancel
 */
export async function cancelPavilionReservationAbandonEmailJobs(
  queue: PavilionReservationAbandonEmailQueue,
  requestIds: readonly string[]
): Promise<void> {
  for (const requestId of requestIds) {
    const job = await queue.getJob(abandonEmailJobId(requestId));
    if (job) {
      await job.remove();
    }
  }
}

/**
 * Enqueues or slides the 1-hour abandon email for a draft pavilion request.
 *
 * @param queue - Default BullMQ queue
 * @param data - Draft request id
 */
export async function enqueuePavilionReservationAbandonEmail(
  queue: PavilionReservationAbandonEmailQueue,
  data: PavilionReservationAbandonEmailJobData
): Promise<void> {
  const jobId = abandonEmailJobId(data.requestId);
  const existing = await queue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (
      state === 'delayed' ||
      state === 'waiting' ||
      state === 'prioritized' ||
      state === 'waiting-children'
    ) {
      await existing.changeDelay(PAVILION_RESERVATION_ABANDON_EMAIL_DELAY_MS);
      return;
    }
    await existing.remove();
  }
  await queue.add(PAVILION_RESERVATION_ABANDON_EMAIL_JOB_NAME, data, {
    ...PAVILION_RESERVATION_ABANDON_EMAIL_JOB_OPTS,
    jobId,
  });
}

/**
 * Sends a one-time resume email for still-incomplete pavilion drafts.
 *
 * @param data - Job payload with request id
 */
export async function processPavilionReservationAbandonEmailJob(
  data: unknown
): Promise<void> {
  const params = pavilionReservationAbandonEmailJobDataSchema.parse(data);
  try {
    const reservation = await prisma.pavilionReservationRequest.findUnique({
      select: abandonEmailReservationSelect,
      where: { id: params.requestId },
    });
    if (!reservation || !isEligibleForAbandonEmail(reservation)) {
      return;
    }
    const claimed = await claimAbandonEmailSend(params.requestId);
    if (!claimed) {
      return;
    }
    const freshReservation = await prisma.pavilionReservationRequest.findUnique(
      {
        select: abandonEmailReservationSelect,
        where: { id: params.requestId },
      }
    );
    if (!freshReservation || !canSendAbandonEmailAfterClaim(freshReservation)) {
      await rollbackAbandonEmailClaim(params.requestId);
      return;
    }
    await sendClaimedAbandonEmail(freshReservation, params.requestId);
  } catch (error) {
    logger.error(
      '[pavilion-reservation:abandon-email] request_id={requestId} error_name={errorName} error_code={errorCode}',
      {
        errorCode: safeErrorCode(error) ?? 'unknown',
        errorName: safeErrorName(error),
        requestId: params.requestId,
      }
    );
    throw error;
  }
}
