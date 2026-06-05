import type { JobsOptions, Queue } from 'bullmq';
import * as z from 'zod';
import { prisma } from '@/libs/DB';
import { sendPavilionReservationSubmittedEmail } from '@/libs/email/pavilion-reservation-emails';
import { logger } from '@/libs/Logger';
import { formatEasternShortDateFromIsoCalendar } from '@/libs/mit-sailing/easternTimeFormat';
import { isoCalendarDateFromPrismaDate } from '@/libs/mit-sailing/isoCalendarDate';
import { formatPavilionReservationTimeLabel } from '@/libs/mit-sailing/pavilionReservationTimeLabel';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';

export const PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME =
  'pavilion-reservation-submitted-email';

const pavilionReservationSubmittedEmailJobDataSchema = z.object({
  referenceCode: z.string().min(1),
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

type PavilionReservationSubmittedEmailRequest = {
  eventName: string;
  requesterEmail: string;
  slots: readonly {
    endMinutes: number;
    item: { name: string };
    requestedDate: Date;
    startMinutes: number;
  }[];
};

function scheduleLinesForEmail(
  slots: PavilionReservationSubmittedEmailRequest['slots']
): string[] {
  return slots.map(
    (slot) =>
      `${slot.item.name}: ${formatEasternShortDateFromIsoCalendar(
        isoCalendarDateFromPrismaDate(slot.requestedDate)
      )} · ${formatPavilionReservationTimeLabel(slot.startMinutes)} - ${formatPavilionReservationTimeLabel(slot.endMinutes)}`
  );
}

async function findReservationForSubmittedEmail(referenceCode: string) {
  const reservation = await prisma.pavilionReservationRequest.findUnique({
    select: {
      eventName: true,
      requesterEmail: true,
      slots: {
        orderBy: { displayOrder: 'asc' },
        select: {
          endMinutes: true,
          item: { select: { name: true } },
          requestedDate: true,
          startMinutes: true,
        },
      },
    },
    where: { referenceCode },
  });
  return reservation;
}

export async function enqueuePavilionReservationSubmittedEmail(
  queue: PavilionReservationSubmittedEmailQueue,
  data: PavilionReservationSubmittedEmailJobData
): Promise<void> {
  await queue.add(PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME, data, {
    ...PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_OPTS,
    jobId: `${PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME}-${data.referenceCode}`,
  });
}

export async function processPavilionReservationSubmittedEmailJob(
  data: unknown
): Promise<void> {
  const params = pavilionReservationSubmittedEmailJobDataSchema.parse(data);
  try {
    const reservation = await findReservationForSubmittedEmail(
      params.referenceCode
    );
    if (!reservation) {
      return;
    }
    await sendPavilionReservationSubmittedEmail({
      eventName: reservation.eventName,
      referenceCode: params.referenceCode,
      requesterEmail: reservation.requesterEmail,
      scheduleLines: scheduleLinesForEmail(reservation.slots),
    });
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
