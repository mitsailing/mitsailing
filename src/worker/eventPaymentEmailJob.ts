import type { JobsOptions, Queue } from 'bullmq';
import * as z from 'zod';
import { EventPaymentNotificationKind } from '@/generated/prisma/enums';
import { EVENTS_TIME_ZONE } from '@/lib/mit-sailing/nyTime';
import { prisma } from '@/libs/DB';
import {
  sendEventPaymentAdminDigestEmail,
  sendEventPaymentReceiptEmail,
  sendEventPaymentReminderEmail,
  sendEventPaymentRequestEmail,
} from '@/libs/email/event-payment-emails';
import type { SendEmailResult } from '@/libs/email/sendTransactional';
import { logger } from '@/libs/Logger';
import { nyEventPaymentNotificationDateKey } from '@/libs/mit-sailing/eventPayments';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';
import {
  EVENT_PAYMENT_REMINDER_STATUSES,
  formatEventPaymentDate,
  paymentCanReceiveNotification,
  paymentEmailParams,
} from './eventPaymentEmailContent';
import type { PaymentEmailRow } from './eventPaymentEmailContent';
import {
  clearNotificationClaim,
  clearNotificationClaims,
  ensureNotificationMarker,
  notificationKindForJob,
  recordProviderMessageId,
} from './eventPaymentNotificationStore';

export const EVENT_PAYMENT_EMAIL_JOB_NAME = 'event-payment-email';
export const EVENT_PAYMENT_DAILY_NOTIFICATIONS_JOB_NAME =
  'event-payment-daily-notifications';
const EVENT_PAYMENT_DAILY_NOTIFICATIONS_SCHEDULER_ID =
  'event-payment-daily-notifications-7am-eastern';

const paymentJobSchema = z.object({
  dateKey: z.string().min(1),
  kind: z.enum(['request', 'receipt', 'reminder']),
  paymentId: z.string().min(1),
});

const adminDigestJobSchema = z.object({
  dateKey: z.string().min(1),
  eventId: z.string().min(1),
  kind: z.literal('admin_digest'),
});

const dailyJobSchema = z.object({
  kind: z.literal('daily'),
});

const eventPaymentEmailJobSchema = z.discriminatedUnion('kind', [
  paymentJobSchema,
  adminDigestJobSchema,
  dailyJobSchema,
]);

const EVENT_PAYMENT_EMAIL_JOB_OPTS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 60_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
};

type EventPaymentEmailJobData = z.infer<typeof eventPaymentEmailJobSchema>;

type EventPaymentQueueData = Exclude<
  EventPaymentEmailJobData,
  { kind: 'daily' }
>;

export type EventPaymentEmailQueue = Pick<
  Queue<EventPaymentEmailJobData>,
  'add' | 'upsertJobScheduler'
>;

function jobId(data: EventPaymentQueueData): string {
  if (data.kind === 'admin_digest') {
    return `${EVENT_PAYMENT_EMAIL_JOB_NAME}:${data.kind}:${data.eventId}:${data.dateKey}`;
  }
  return `${EVENT_PAYMENT_EMAIL_JOB_NAME}:${data.kind}:${data.paymentId}:${data.dateKey}`;
}

async function findPayment(paymentId: string): Promise<PaymentEmailRow | null> {
  const payment = await prisma.eventPayment.findUnique({
    include: {
      event: {
        select: {
          dates: { select: { startDateTime: true } },
          addressCity: true,
          addressCountry: true,
          addressLine1: true,
          addressLine2: true,
          addressName: true,
          addressPostalCode: true,
          addressState: true,
          name: true,
          paymentDeadlineAt: true,
          slug: true,
        },
      },
      user: { select: { email: true, name: true } },
    },
    where: { id: paymentId },
  });
  return payment;
}

async function processPaymentEmailJob(
  data: z.infer<typeof paymentJobSchema>
): Promise<void> {
  const payment = await findPayment(data.paymentId);
  if (
    !payment ||
    !paymentCanReceiveNotification({
      kind: data.kind,
      now: new Date(),
      payment,
    })
  ) {
    return;
  }

  const marker = await ensureNotificationMarker({
    dateKey: data.dateKey,
    kind: notificationKindForJob(data.kind),
    paymentId: payment.id,
  });
  if (!marker) {
    return;
  }

  const params = paymentEmailParams({
    dateKey: data.dateKey,
    kind: data.kind,
    payment,
  });
  let result: SendEmailResult;
  try {
    if (data.kind === 'receipt') {
      result = await sendEventPaymentReceiptEmail(params);
    } else if (data.kind === 'reminder') {
      result = await sendEventPaymentReminderEmail(params);
    } else {
      result = await sendEventPaymentRequestEmail(params);
    }
  } catch (error) {
    await clearNotificationClaim({
      claimId: marker.claimId,
      notificationId: marker.id,
    });
    throw error;
  }
  await recordProviderMessageId({
    claimId: marker.claimId,
    notificationId: marker.id,
    providerMessageId: result.providerMessageId,
  });
}

async function processAdminDigestJob(
  data: z.infer<typeof adminDigestJobSchema>
): Promise<void> {
  const event = await prisma.event.findUnique({
    select: {
      admins: {
        select: {
          admin: { select: { email: true } },
        },
      },
      name: true,
      paymentDeadlineAt: true,
      payments: {
        include: {
          event: {
            select: {
              dates: { select: { startDateTime: true } },
              addressCity: true,
              addressCountry: true,
              addressLine1: true,
              addressLine2: true,
              addressName: true,
              addressPostalCode: true,
              addressState: true,
              name: true,
              paymentDeadlineAt: true,
              slug: true,
            },
          },
          user: { select: { email: true, name: true } },
        },
        where: {
          notifications: {
            none: {
              kind: EventPaymentNotificationKind.admin_digest,
              sentDateKey: data.dateKey,
            },
          },
          status: { in: EVENT_PAYMENT_REMINDER_STATUSES },
        },
      },
    },
    where: { id: data.eventId },
  });
  if (!event || event.payments.length === 0) {
    return;
  }
  const adminEmails = event.admins
    .map((row) => row.admin.email.trim())
    .filter((email) => email.length > 0);
  const adminEmail = adminEmails.at(0);
  if (!adminEmail) {
    return;
  }

  const markers: { claimId: string; id: string; paymentId: string }[] = [];
  for (const payment of event.payments) {
    const marker = await ensureNotificationMarker({
      dateKey: data.dateKey,
      kind: EventPaymentNotificationKind.admin_digest,
      paymentId: payment.id,
    });
    if (marker) {
      markers.push({
        claimId: marker.claimId,
        id: marker.id,
        paymentId: payment.id,
      });
    }
  }
  if (markers.length === 0) {
    return;
  }

  let result: SendEmailResult;
  try {
    result = await sendEventPaymentAdminDigestEmail({
      adminEmail,
      deadline: event.paymentDeadlineAt
        ? formatEventPaymentDate(event.paymentDeadlineAt)
        : 'No deadline',
      emailDedupeKey: `${data.eventId}:admin_digest:${data.dateKey}`,
      eventName: event.name,
      overduePayments: event.payments.map((payment) => ({
        amount: formatUsdMinorUnitsAsCurrency(payment.amountCents, 'en-US'),
        id: payment.id,
        recipientEmail: payment.user.email,
        recipientName: payment.user.name ?? payment.user.email,
        selectedFeeDescription: payment.selectedFeeDescription,
      })),
    });
  } catch (error) {
    await clearNotificationClaims(markers);
    throw error;
  }

  for (const marker of markers) {
    await recordProviderMessageId({
      claimId: marker.claimId,
      notificationId: marker.id,
      providerMessageId: result.providerMessageId,
    });
  }
}

function isSevenEasternHour(now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: EVENTS_TIME_ZONE,
  }).formatToParts(now);
  return Number(parts.find((part) => part.type === 'hour')?.value) === 7;
}

export async function enqueueEventPaymentEmailJob(
  queue: Pick<Queue<EventPaymentEmailJobData>, 'add'>,
  data: EventPaymentQueueData
): Promise<void> {
  await queue.add(EVENT_PAYMENT_EMAIL_JOB_NAME, data, {
    ...EVENT_PAYMENT_EMAIL_JOB_OPTS,
    jobId: jobId(data),
  });
}

async function enqueueDuePaymentReminderJobs(options: {
  dateKey: string;
  now: Date;
  queue: Pick<Queue<EventPaymentEmailJobData>, 'add'>;
}): Promise<void> {
  const payments = await prisma.eventPayment.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
    where: {
      event: {
        dates: { some: { startDateTime: { gt: options.now } } },
        paymentDeadlineAt: { not: null },
      },
      notifications: {
        none: {
          kind: EventPaymentNotificationKind.reminder,
          sentDateKey: options.dateKey,
        },
      },
      status: { in: EVENT_PAYMENT_REMINDER_STATUSES },
    },
  });
  await Promise.all(
    payments.map(async (payment) => {
      await enqueueEventPaymentEmailJob(options.queue, {
        dateKey: options.dateKey,
        kind: 'reminder',
        paymentId: payment.id,
      });
    })
  );
}

async function enqueueDueAdminDigestJobs(options: {
  dateKey: string;
  now: Date;
  queue: Pick<Queue<EventPaymentEmailJobData>, 'add'>;
}): Promise<void> {
  const events = await prisma.event.findMany({
    orderBy: { name: 'asc' },
    select: { id: true },
    where: {
      dates: { some: { startDateTime: { gt: options.now } } },
      paymentDeadlineAt: { lte: options.now },
      payments: {
        some: {
          notifications: {
            none: {
              kind: EventPaymentNotificationKind.admin_digest,
              sentDateKey: options.dateKey,
            },
          },
          status: { in: EVENT_PAYMENT_REMINDER_STATUSES },
        },
      },
    },
  });
  await Promise.all(
    events.map(async (event) => {
      await enqueueEventPaymentEmailJob(options.queue, {
        dateKey: options.dateKey,
        eventId: event.id,
        kind: 'admin_digest',
      });
    })
  );
}

export async function enqueueDueEventPaymentNotifications(
  queue: Pick<Queue<EventPaymentEmailJobData>, 'add'>,
  now: Date
): Promise<void> {
  const dateKey = nyEventPaymentNotificationDateKey(now);
  if (!isSevenEasternHour(now)) {
    return;
  }

  await enqueueDuePaymentReminderJobs({ dateKey, now, queue });
  await enqueueDueAdminDigestJobs({ dateKey, now, queue });
}

export async function registerEventPaymentDailyNotificationScheduler(
  queue: EventPaymentEmailQueue
): Promise<void> {
  await queue.upsertJobScheduler(
    EVENT_PAYMENT_DAILY_NOTIFICATIONS_SCHEDULER_ID,
    { pattern: '0 0 7 * * *', tz: EVENTS_TIME_ZONE },
    {
      data: { kind: 'daily' },
      name: EVENT_PAYMENT_DAILY_NOTIFICATIONS_JOB_NAME,
      opts: EVENT_PAYMENT_EMAIL_JOB_OPTS,
    }
  );
}

export async function processEventPaymentEmailJob(
  data: unknown,
  queue?: Pick<Queue<EventPaymentEmailJobData>, 'add'>
): Promise<void> {
  const params = eventPaymentEmailJobSchema.parse(data);
  try {
    if (params.kind === 'daily') {
      if (!queue) {
        throw new Error(
          'Event payment daily notification job requires a queue.'
        );
      }
      await enqueueDueEventPaymentNotifications(queue, new Date());
      return;
    }
    if (params.kind === 'admin_digest') {
      await processAdminDigestJob(params);
      return;
    }
    await processPaymentEmailJob(params);
  } catch (error) {
    logger.error(
      '[event-payment-email] kind={kind} error_name={errorName} error_code={errorCode}',
      {
        errorCode: safeErrorCode(error) ?? 'unknown',
        errorName: safeErrorName(error),
        kind: params.kind,
      }
    );
    throw error;
  }
}
