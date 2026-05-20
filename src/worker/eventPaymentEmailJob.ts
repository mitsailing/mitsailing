import { randomUUID } from 'node:crypto';
import type { JobsOptions, Queue } from 'bullmq';
import * as z from 'zod';
import {
  EventPaymentNotificationKind,
  EventPaymentStatus,
} from '@/generated/prisma/enums';
import type { EventPaymentStatus as EventPaymentStatusType } from '@/generated/prisma/enums';
import { EVENTS_TIME_ZONE } from '@/lib/mit-sailing/nyTime';
import { prisma } from '@/libs/DB';
import {
  sendEventPaymentAdminDigestEmail,
  sendEventPaymentReceiptEmail,
  sendEventPaymentReminderEmail,
  sendEventPaymentRequestEmail,
} from '@/libs/email/event-payment-emails';
import type { SendEmailResult } from '@/libs/email/sendTransactional';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { nyEventPaymentNotificationDateKey } from '@/libs/mit-sailing/eventPayments';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';

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

const reminderStatuses: EventPaymentStatusType[] = [
  EventPaymentStatus.checkout_created,
  EventPaymentStatus.past_due,
  EventPaymentStatus.pending,
];
const notificationClaimPrefix = 'claim:';
const notificationClaimTtlMs = 15 * 60 * 1000;

type EventPaymentEmailJobData = z.infer<typeof eventPaymentEmailJobSchema>;

type EventPaymentQueueData = Exclude<
  EventPaymentEmailJobData,
  { kind: 'daily' }
>;

export type EventPaymentEmailQueue = Pick<
  Queue<EventPaymentEmailJobData>,
  'add' | 'upsertJobScheduler'
>;

type PaymentNotificationKind =
  | typeof EventPaymentNotificationKind.admin_digest
  | typeof EventPaymentNotificationKind.receipt
  | typeof EventPaymentNotificationKind.reminder
  | typeof EventPaymentNotificationKind.request;

type PaymentEmailRow = {
  amountCents: number;
  event: {
    addressCity: string | null;
    addressCountry: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    addressName: string | null;
    addressPostalCode: string | null;
    addressState: string | null;
    dates?: readonly { startDateTime: Date }[];
    name: string;
    paymentDeadlineAt: Date | null;
    slug: string;
  };
  id: string;
  selectedFeeDescription: string;
  status: EventPaymentStatus;
  stripeReceiptUrl: string | null;
  user: {
    email: string;
    name: string | null;
  };
};

function notificationKindForJob(
  kind: 'receipt' | 'reminder' | 'request'
): PaymentNotificationKind {
  if (kind === 'receipt') {
    return EventPaymentNotificationKind.receipt;
  }
  if (kind === 'reminder') {
    return EventPaymentNotificationKind.reminder;
  }
  return EventPaymentNotificationKind.request;
}

function jobId(data: EventPaymentQueueData): string {
  if (data.kind === 'admin_digest') {
    return `${EVENT_PAYMENT_EMAIL_JOB_NAME}:${data.kind}:${data.eventId}:${data.dateKey}`;
  }
  return `${EVENT_PAYMENT_EMAIL_JOB_NAME}:${data.kind}:${data.paymentId}:${data.dateKey}`;
}

function baseUrl(): string {
  return Env.NEXT_PUBLIC_APP_URL.endsWith('/')
    ? Env.NEXT_PUBLIC_APP_URL.slice(0, -1)
    : Env.NEXT_PUBLIC_APP_URL;
}

function checkoutUrl(payment: PaymentEmailRow): string {
  return `${baseUrl()}/events/${encodeURIComponent(payment.event.slug)}/checkout`;
}

function eventAddressLines(event: PaymentEmailRow['event']): string[] {
  return [
    event.addressName,
    event.addressLine1,
    event.addressLine2,
    [event.addressCity, event.addressState, event.addressPostalCode]
      .filter(Boolean)
      .join(' '),
    event.addressCountry,
  ].filter(
    (part): part is string => typeof part === 'string' && part.length > 0
  );
}

function eventAddressMapHref(lines: readonly string[]): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    lines.join(', ')
  )}`;
}

function formatEventPaymentDate(date: Date): string {
  return `${new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: EVENTS_TIME_ZONE,
  }).format(date)} ET`;
}

function paymentEmailParams(options: {
  dateKey: string;
  kind: 'receipt' | 'reminder' | 'request';
  payment: PaymentEmailRow;
}) {
  const addressLines = eventAddressLines(options.payment.event);
  return {
    amount: formatUsdMinorUnitsAsCurrency(options.payment.amountCents, 'en-US'),
    checkoutUrl: checkoutUrl(options.payment),
    deadline: options.payment.event.paymentDeadlineAt
      ? formatEventPaymentDate(options.payment.event.paymentDeadlineAt)
      : 'No deadline',
    emailDedupeKey: `${options.payment.id}:${options.kind}:${options.dateKey}`,
    eventAddress: addressLines.length > 0 ? addressLines.join(', ') : null,
    eventAddressUrl:
      addressLines.length > 0 ? eventAddressMapHref(addressLines) : null,
    eventName: options.payment.event.name,
    receiptUrl: options.payment.stripeReceiptUrl,
    recipientEmail: options.payment.user.email,
    recipientName: options.payment.user.name ?? options.payment.user.email,
    selectedFeeDescription: options.payment.selectedFeeDescription,
  };
}

function isPaymentPastEventDate(payment: PaymentEmailRow, now: Date): boolean {
  const dates = payment.event.dates ?? [];
  return dates.length > 0 && !dates.some((date) => date.startDateTime > now);
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

function paymentCanReceiveNotification(options: {
  kind: 'receipt' | 'reminder' | 'request';
  now: Date;
  payment: PaymentEmailRow;
}): boolean {
  if (options.kind === 'receipt') {
    return options.payment.status === EventPaymentStatus.paid;
  }
  return (
    reminderStatuses.includes(options.payment.status) &&
    !isPaymentPastEventDate(options.payment, options.now)
  );
}

async function ensureNotificationMarker(options: {
  dateKey: string;
  kind: PaymentNotificationKind;
  paymentId: string;
}): Promise<{ claimId: string; id: string } | null> {
  const claimId = `${notificationClaimPrefix}${randomUUID()}`;
  const marker = await prisma.eventPaymentNotification.upsert({
    create: {
      kind: options.kind,
      paymentId: options.paymentId,
      sentDateKey: options.dateKey,
    },
    update: {},
    where: {
      paymentId_kind_sentDateKey: {
        kind: options.kind,
        paymentId: options.paymentId,
        sentDateKey: options.dateKey,
      },
    },
  });
  if (
    marker.providerMessageId &&
    !marker.providerMessageId.startsWith(notificationClaimPrefix)
  ) {
    return null;
  }

  const staleClaimBefore = new Date(Date.now() - notificationClaimTtlMs);
  const claim = await prisma.eventPaymentNotification.updateMany({
    data: { providerMessageId: claimId },
    where: {
      id: marker.id,
      OR: [
        { providerMessageId: null },
        {
          providerMessageId: { startsWith: notificationClaimPrefix },
          updatedAt: { lt: staleClaimBefore },
        },
      ],
    },
  });
  if (claim.count === 0) {
    return null;
  }
  return { claimId, id: marker.id };
}

async function clearNotificationClaim(options: {
  claimId: string;
  notificationId: string;
}): Promise<void> {
  await prisma.eventPaymentNotification.updateMany({
    data: { providerMessageId: null },
    where: {
      id: options.notificationId,
      providerMessageId: options.claimId,
    },
  });
}

async function recordProviderMessageId(options: {
  claimId: string;
  notificationId: string;
  providerMessageId: string | null;
}): Promise<void> {
  await prisma.eventPaymentNotification.updateMany({
    data: {
      providerMessageId:
        options.providerMessageId ?? `sent-without-provider:${options.claimId}`,
    },
    where: {
      id: options.notificationId,
      providerMessageId: options.claimId,
    },
  });
}

async function clearNotificationClaims(
  markers: readonly { claimId: string; id: string }[]
): Promise<void> {
  const results = await Promise.allSettled(
    markers.map(async (marker) => {
      await clearNotificationClaim({
        claimId: marker.claimId,
        notificationId: marker.id,
      });
    })
  );
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      continue;
    }
    const marker = markers[index];
    logger.error(
      '[event-payment-email] admin_digest cleanup_failed notification_id={notificationId} error_name={errorName} error_code={errorCode}',
      {
        errorCode: safeErrorCode(result.reason) ?? 'unknown',
        errorName: safeErrorName(result.reason),
        notificationId: marker?.id ?? 'unknown',
      }
    );
  }
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
          status: { in: reminderStatuses },
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
      status: { in: reminderStatuses },
    },
  });
  for (const payment of payments) {
    await enqueueEventPaymentEmailJob(options.queue, {
      dateKey: options.dateKey,
      kind: 'reminder',
      paymentId: payment.id,
    });
  }
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
          status: { in: reminderStatuses },
        },
      },
    },
  });
  for (const event of events) {
    await enqueueEventPaymentEmailJob(options.queue, {
      dateKey: options.dateKey,
      eventId: event.id,
      kind: 'admin_digest',
    });
  }
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
