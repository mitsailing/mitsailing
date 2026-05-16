import type { JobsOptions, Queue } from 'bullmq';
import * as z from 'zod';
import { sendPavilionReservationSubmittedEmail } from '@/libs/email/pavilion-reservation-emails';
import { logger } from '@/libs/Logger';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';

export const PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME =
  'pavilion-reservation-submitted-email';

const pavilionReservationSubmittedEmailJobDataSchema = z.object({
  eventName: z.string().min(1),
  referenceCode: z.string().min(1),
  requesterEmail: z.email(),
  scheduleLines: z.array(z.string()),
});

const PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_OPTS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 60_000 },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
};

export type PavilionReservationSubmittedEmailJobData = z.infer<
  typeof pavilionReservationSubmittedEmailJobDataSchema
>;

export type PavilionReservationSubmittedEmailQueue = Pick<
  Queue<PavilionReservationSubmittedEmailJobData>,
  'add'
>;

export async function enqueuePavilionReservationSubmittedEmail(
  queue: PavilionReservationSubmittedEmailQueue,
  data: PavilionReservationSubmittedEmailJobData
): Promise<void> {
  await queue.add(PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME, data, {
    ...PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_OPTS,
    jobId: `${PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME}:${data.referenceCode}`,
  });
}

export async function processPavilionReservationSubmittedEmailJob(
  data: unknown
): Promise<void> {
  const params = pavilionReservationSubmittedEmailJobDataSchema.parse(data);
  try {
    await sendPavilionReservationSubmittedEmail(params);
  } catch (error) {
    logger.error(
      '[pavilion-reservation:create-email] reference_code={referenceCode} error_name={errorName} error_code={errorCode}',
      {
        errorCode: safeErrorCode(error) ?? 'unknown',
        errorName: safeErrorName(error),
        referenceCode: params.referenceCode,
      }
    );
    throw error;
  }
}
