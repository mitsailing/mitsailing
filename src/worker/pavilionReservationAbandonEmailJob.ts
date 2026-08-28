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
      select: {
        abandonEmailSentAt: true,
        eventName: true,
        referenceCode: true,
        requesterEmail: true,
        resumeToken: true,
        status: true,
      },
      where: { id: params.requestId },
    });
    if (!reservation) {
      return;
    }
    if (
      reservation.status !== 'draft' ||
      reservation.abandonEmailSentAt !== null ||
      reservation.resumeToken === null ||
      reservation.resumeToken === ''
    ) {
      return;
    }

    const claim = await prisma.pavilionReservationRequest.updateMany({
      data: { abandonEmailSentAt: new Date() },
      where: {
        abandonEmailSentAt: null,
        id: params.requestId,
        resumeToken: { not: null },
        status: 'draft',
      },
    });
    if (claim.count === 0) {
      return;
    }

    const resumeUrl = `${Env.NEXT_PUBLIC_APP_URL}/reserve?resume=${encodeURIComponent(reservation.resumeToken)}`;
    try {
      await sendPavilionReservationAbandonEmail({
        eventName: reservation.eventName,
        referenceCode: reservation.referenceCode,
        requesterEmail: reservation.requesterEmail,
        resumeUrl,
      });
    } catch (error) {
      await prisma.pavilionReservationRequest.updateMany({
        data: { abandonEmailSentAt: null },
        where: {
          abandonEmailSentAt: { not: null },
          id: params.requestId,
          status: 'draft',
        },
      });
      throw error;
    }
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
