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

type ClaimedAbandonEmailReservation = AbandonEmailReservation & {
  resumeToken: string;
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

function hasResumeToken(
  reservation: AbandonEmailReservation
): reservation is ClaimedAbandonEmailReservation {
  return reservation.resumeToken !== null && reservation.resumeToken !== '';
}

function isEligibleForAbandonEmail(
  reservation: AbandonEmailReservation
): reservation is ClaimedAbandonEmailReservation {
  return (
    reservation.status === 'draft' &&
    reservation.abandonEmailSentAt === null &&
    hasResumeToken(reservation)
  );
}

function canSendAbandonEmailAfterClaim(
  reservation: AbandonEmailReservation
): reservation is ClaimedAbandonEmailReservation {
  return reservation.status === 'draft' && hasResumeToken(reservation);
}

async function findAbandonEmailReservation(requestId: string) {
  const reservation = await prisma.pavilionReservationRequest.findUnique({
    select: abandonEmailReservationSelect,
    where: { id: requestId },
  });
  return reservation;
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
  reservation: ClaimedAbandonEmailReservation,
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
 * Re-reads draft state after the send claim so a concurrent submit can roll back.
 *
 * @param requestId - Pavilion reservation request id
 * @returns Resolves after send or claim rollback
 */
async function sendAbandonEmailAfterFreshClaim(
  requestId: string
): Promise<void> {
  const freshReservation = await findAbandonEmailReservation(requestId);
  if (!freshReservation || !canSendAbandonEmailAfterClaim(freshReservation)) {
    await rollbackAbandonEmailClaim(requestId);
    return;
  }
  await sendClaimedAbandonEmail(freshReservation, requestId);
}

async function attemptAbandonEmailSend(requestId: string): Promise<void> {
  const reservation = await findAbandonEmailReservation(requestId);
  if (!reservation || !isEligibleForAbandonEmail(reservation)) {
    return;
  }
  const claimed = await claimAbandonEmailSend(requestId);
  if (!claimed) {
    return;
  }
  await sendAbandonEmailAfterFreshClaim(requestId);
}

const REMOVABLE_ABANDON_EMAIL_JOB_STATES = new Set([
  'prioritized',
  'waiting',
  'waiting-children',
]);

/**
 * Slides a delayed abandon job, or replaces a non-delayed duplicate.
 *
 * BullMQ `changeDelay` only applies to jobs in the delayed state; waiting
 * duplicates are removed so a fresh delayed job can be added.
 *
 * @param queue - Default BullMQ queue
 * @param jobId - Stable abandon-email job id
 * @returns Whether the existing delayed job was rescheduled
 * @see https://docs.bullmq.io/guide/jobs/delayed
 */
async function rescheduleOrReplaceAbandonEmailJob(
  queue: PavilionReservationAbandonEmailQueue,
  jobId: string
): Promise<boolean> {
  const existing = await queue.getJob(jobId);
  if (!existing) {
    return false;
  }
  const state = await existing.getState();
  if (state === 'delayed') {
    await existing.changeDelay(PAVILION_RESERVATION_ABANDON_EMAIL_DELAY_MS);
    return true;
  }
  if (REMOVABLE_ABANDON_EMAIL_JOB_STATES.has(state)) {
    await existing.remove();
  }
  return false;
}

/**
 * Removes queued abandon-email jobs for the given draft request ids.
 *
 * @param queue - Default BullMQ queue
 * @param requestIds - Draft request ids to cancel
 * @returns Resolves when matching jobs are removed
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
 * Uses a stable `jobId` so draft autosaves throttle to one delayed job
 * (BullMQ named-job / jobId pattern).
 *
 * @param queue - Default BullMQ queue
 * @param data - Draft request id
 * @returns Resolves when the delayed job is scheduled
 */
export async function enqueuePavilionReservationAbandonEmail(
  queue: PavilionReservationAbandonEmailQueue,
  data: PavilionReservationAbandonEmailJobData
): Promise<void> {
  const jobId = abandonEmailJobId(data.requestId);
  const rescheduled = await rescheduleOrReplaceAbandonEmailJob(queue, jobId);
  if (rescheduled) {
    return;
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
 * @returns Resolves when send is skipped, claimed, or completed
 */
export async function processPavilionReservationAbandonEmailJob(
  data: unknown
): Promise<void> {
  const params = pavilionReservationAbandonEmailJobDataSchema.parse(data);
  try {
    await attemptAbandonEmailSend(params.requestId);
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
