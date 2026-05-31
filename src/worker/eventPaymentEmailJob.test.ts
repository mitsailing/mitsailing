import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EventPaymentNotificationKind,
  PaymentStatus,
} from '@/generated/prisma/enums';

const mocks = vi.hoisted(() => ({
  eventFindMany: vi.fn(),
  eventFindUnique: vi.fn(),
  eventPaymentFindMany: vi.fn(),
  eventPaymentFindUnique: vi.fn(),
  eventPaymentNotificationFindUnique: vi.fn(),
  eventPaymentNotificationUpdate: vi.fn(),
  eventPaymentNotificationUpdateMany: vi.fn(),
  eventPaymentNotificationUpsert: vi.fn(),
  loggerError: vi.fn(),
  sendEventPaymentAdminDigestEmail: vi.fn(),
  sendEventPaymentReceiptEmail: vi.fn(),
  sendEventPaymentReminderEmail: vi.fn(),
  sendEventPaymentRequestEmail: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    event: {
      findMany: mocks.eventFindMany,
      findUnique: mocks.eventFindUnique,
    },
    payment: {
      findMany: mocks.eventPaymentFindMany,
      findUnique: mocks.eventPaymentFindUnique,
    },
    eventPaymentNotification: {
      findUnique: mocks.eventPaymentNotificationFindUnique,
      update: mocks.eventPaymentNotificationUpdate,
      updateMany: mocks.eventPaymentNotificationUpdateMany,
      upsert: mocks.eventPaymentNotificationUpsert,
    },
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

vi.mock('@/libs/email/event-payment-emails', () => ({
  sendEventPaymentAdminDigestEmail: mocks.sendEventPaymentAdminDigestEmail,
  sendEventPaymentReceiptEmail: mocks.sendEventPaymentReceiptEmail,
  sendEventPaymentReminderEmail: mocks.sendEventPaymentReminderEmail,
  sendEventPaymentRequestEmail: mocks.sendEventPaymentRequestEmail,
}));

const paymentRow = {
  amountCents: 4500,
  event: {
    addressCity: 'Cambridge',
    addressCountry: 'US',
    addressLine1: '134 Memorial Drive',
    addressLine2: null,
    addressName: 'MIT Sailing Pavilion',
    addressPostalCode: '02139',
    addressState: 'MA',
    dates: [{ startDateTime: new Date('2026-06-03T13:00:00.000Z') }],
    name: 'Frostbite Regatta',
    paymentDeadlineAt: new Date('2026-06-01T11:00:00.000Z'),
    slug: 'frostbite',
  },
  id: 'payment-1',
  selectedFeeDescription: 'Adult entry',
  status: PaymentStatus.pending,
  stripeReceiptUrl: 'https://pay.stripe.com/receipts/test',
  user: {
    email: 'sailor@example.com',
    name: 'Ada Sailor',
  },
};

describe('event payment email job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eventPaymentFindUnique.mockResolvedValue(paymentRow);
    mocks.eventPaymentNotificationFindUnique.mockResolvedValue(null);
    mocks.eventPaymentNotificationUpsert.mockResolvedValue({
      id: 'notification-1',
      providerMessageId: null,
    });
    mocks.eventPaymentNotificationUpdateMany.mockResolvedValue({ count: 1 });
    mocks.eventPaymentNotificationUpdate.mockResolvedValue({});
    mocks.sendEventPaymentRequestEmail.mockResolvedValue({
      providerMessageId: 'email_request',
    });
    mocks.sendEventPaymentReceiptEmail.mockResolvedValue({
      providerMessageId: 'email_receipt',
    });
    mocks.sendEventPaymentReminderEmail.mockResolvedValue({
      providerMessageId: 'email_reminder',
    });
    mocks.sendEventPaymentAdminDigestEmail.mockResolvedValue({
      providerMessageId: 'email_digest',
    });
  });

  it('enqueues payment email jobs with stable dedupe ids', async () => {
    const { enqueueEventPaymentEmailJob } =
      await import('@/worker/eventPaymentEmailJob');
    const queue = { add: vi.fn().mockResolvedValue({ id: 'job-1' }) };

    await enqueueEventPaymentEmailJob(queue, {
      dateKey: '2026-06-01',
      kind: 'request',
      paymentId: 'payment-1',
    });

    expect(queue.add).toHaveBeenCalledWith(
      'event-payment-email',
      {
        dateKey: '2026-06-01',
        kind: 'request',
        paymentId: 'payment-1',
      },
      expect.objectContaining({
        jobId: 'event-payment-email:request:payment-1:2026-06-01',
      })
    );
  });

  it('sends a request email once for a payment and date', async () => {
    const { processEventPaymentEmailJob } =
      await import('@/worker/eventPaymentEmailJob');

    await processEventPaymentEmailJob({
      dateKey: '2026-06-01',
      kind: 'request',
      paymentId: 'payment-1',
    });

    expect(mocks.eventPaymentNotificationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          kind: EventPaymentNotificationKind.request,
          paymentId: 'payment-1',
          sentDateKey: '2026-06-01',
        }),
      })
    );
    expect(mocks.sendEventPaymentRequestEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        checkoutUrl: expect.stringContaining('/events/frostbite/checkout'),
        emailDedupeKey: 'payment-1:request:2026-06-01',
        eventAddress:
          'MIT Sailing Pavilion, 134 Memorial Drive, Cambridge MA 02139, US',
        eventAddressUrl: expect.stringContaining(
          'https://www.google.com/maps/search/'
        ),
        recipientEmail: 'sailor@example.com',
      })
    );
    expect(mocks.eventPaymentNotificationUpdateMany).toHaveBeenLastCalledWith({
      data: { providerMessageId: 'email_request' },
      where: {
        id: 'notification-1',
        providerMessageId: expect.stringMatching(/^claim:/u),
      },
    });
  });

  it('does not send duplicate notifications with provider ids', async () => {
    mocks.eventPaymentNotificationUpsert.mockResolvedValueOnce({
      id: 'notification-1',
      providerMessageId: 'email_existing',
    });

    const { processEventPaymentEmailJob } =
      await import('@/worker/eventPaymentEmailJob');

    await processEventPaymentEmailJob({
      dateKey: '2026-06-01',
      kind: 'request',
      paymentId: 'payment-1',
    });

    expect(mocks.sendEventPaymentRequestEmail).not.toHaveBeenCalled();
    expect(mocks.eventPaymentNotificationUpdateMany).not.toHaveBeenCalled();
  });

  it('reclaims stale notification claims', async () => {
    mocks.eventPaymentNotificationUpsert.mockResolvedValueOnce({
      id: 'notification-1',
      providerMessageId: 'claim:stale-worker',
    });
    const { processEventPaymentEmailJob } =
      await import('@/worker/eventPaymentEmailJob');

    await processEventPaymentEmailJob({
      dateKey: '2026-06-01',
      kind: 'request',
      paymentId: 'payment-1',
    });

    expect(mocks.eventPaymentNotificationUpdateMany).toHaveBeenNthCalledWith(
      1,
      {
        data: { providerMessageId: expect.stringMatching(/^claim:/u) },
        where: {
          OR: [
            { providerMessageId: null },
            {
              providerMessageId: { startsWith: 'claim:' },
              updatedAt: { lt: expect.any(Date) },
            },
          ],
          id: 'notification-1',
        },
      }
    );
    expect(mocks.sendEventPaymentRequestEmail).toHaveBeenCalled();
  });

  it('does not send when another worker already claimed the notification', async () => {
    mocks.eventPaymentNotificationUpdateMany.mockResolvedValueOnce({
      count: 0,
    });
    const { processEventPaymentEmailJob } =
      await import('@/worker/eventPaymentEmailJob');

    await processEventPaymentEmailJob({
      dateKey: '2026-06-01',
      kind: 'request',
      paymentId: 'payment-1',
    });

    expect(mocks.sendEventPaymentRequestEmail).not.toHaveBeenCalled();
  });

  it('sends receipts only for locally paid payments', async () => {
    mocks.eventPaymentFindUnique.mockResolvedValueOnce({
      ...paymentRow,
      status: PaymentStatus.paid,
    });
    const { processEventPaymentEmailJob } =
      await import('@/worker/eventPaymentEmailJob');

    await processEventPaymentEmailJob({
      dateKey: '2026-06-01',
      kind: 'receipt',
      paymentId: 'payment-1',
    });

    expect(mocks.sendEventPaymentReceiptEmail).toHaveBeenCalled();
  });

  it('skips receipts for payments that are not locally paid', async () => {
    const { processEventPaymentEmailJob } =
      await import('@/worker/eventPaymentEmailJob');

    await processEventPaymentEmailJob({
      dateKey: '2026-06-01',
      kind: 'receipt',
      paymentId: 'payment-1',
    });

    expect(mocks.sendEventPaymentReceiptEmail).not.toHaveBeenCalled();
    expect(mocks.eventPaymentNotificationUpsert).not.toHaveBeenCalled();
  });

  it('enqueues daily reminders and admin digests at seven eastern', async () => {
    mocks.eventPaymentFindMany.mockResolvedValueOnce([{ id: 'payment-1' }]);
    mocks.eventFindMany.mockResolvedValueOnce([{ id: 'event-1' }]);
    const { enqueueDueEventPaymentNotifications } =
      await import('@/worker/eventPaymentEmailJob');
    const queue = { add: vi.fn().mockResolvedValue({ id: 'job-1' }) };

    await enqueueDueEventPaymentNotifications(
      queue,
      new Date('2026-06-01T11:00:00.000Z')
    );

    expect(queue.add).toHaveBeenCalledWith(
      'event-payment-email',
      expect.objectContaining({
        dateKey: '2026-06-01',
        kind: 'reminder',
        paymentId: 'payment-1',
      }),
      expect.any(Object)
    );
    expect(queue.add).toHaveBeenCalledWith(
      'event-payment-email',
      expect.objectContaining({
        dateKey: '2026-06-01',
        eventId: 'event-1',
        kind: 'admin_digest',
      }),
      expect.any(Object)
    );
    expect(mocks.eventPaymentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [
              PaymentStatus.checkout_created,
              PaymentStatus.past_due,
              PaymentStatus.pending,
            ],
          },
        }),
      })
    );
  });

  it('enqueues daily notifications slightly after seven eastern', async () => {
    mocks.eventPaymentFindMany.mockResolvedValueOnce([{ id: 'payment-1' }]);
    mocks.eventFindMany.mockResolvedValueOnce([{ id: 'event-1' }]);
    const { enqueueDueEventPaymentNotifications } =
      await import('@/worker/eventPaymentEmailJob');
    const queue = { add: vi.fn().mockResolvedValue({ id: 'job-1' }) };

    await enqueueDueEventPaymentNotifications(
      queue,
      new Date('2026-06-01T11:01:00.000Z')
    );

    expect(queue.add).toHaveBeenCalled();
    expect(mocks.eventPaymentFindMany).toHaveBeenCalled();
    expect(mocks.eventFindMany).toHaveBeenCalled();
  });

  it('does not enqueue daily notifications outside seven eastern', async () => {
    const { enqueueDueEventPaymentNotifications } =
      await import('@/worker/eventPaymentEmailJob');
    const queue = { add: vi.fn().mockResolvedValue({ id: 'job-1' }) };

    await enqueueDueEventPaymentNotifications(
      queue,
      new Date('2026-06-01T12:00:00.000Z')
    );

    expect(queue.add).not.toHaveBeenCalled();
    expect(mocks.eventPaymentFindMany).not.toHaveBeenCalled();
    expect(mocks.eventFindMany).not.toHaveBeenCalled();
  });

  it('sends one admin digest email for an event and marks included payments', async () => {
    mocks.eventFindUnique.mockResolvedValueOnce({
      admins: [{ admin: { email: 'admin@example.com' } }],
      name: 'Frostbite Regatta',
      paymentDeadlineAt: new Date('2026-06-01T11:00:00.000Z'),
      payments: [paymentRow],
    });
    const { processEventPaymentEmailJob } =
      await import('@/worker/eventPaymentEmailJob');

    await processEventPaymentEmailJob({
      dateKey: '2026-06-01',
      eventId: 'event-1',
      kind: 'admin_digest',
    });

    expect(mocks.sendEventPaymentAdminDigestEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendEventPaymentAdminDigestEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        adminEmail: 'admin@example.com',
        emailDedupeKey: 'event-1:admin_digest:2026-06-01',
      })
    );
    expect(mocks.eventPaymentNotificationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          kind: EventPaymentNotificationKind.admin_digest,
          paymentId: 'payment-1',
          sentDateKey: '2026-06-01',
        }),
      })
    );
    expect(mocks.eventPaymentNotificationUpdateMany).toHaveBeenLastCalledWith({
      data: { providerMessageId: 'email_digest' },
      where: {
        id: 'notification-1',
        providerMessageId: expect.stringMatching(/^claim:/u),
      },
    });
  });

  it('skips admin digest when event has no admin email', async () => {
    mocks.eventFindUnique.mockResolvedValueOnce({
      admins: [{ admin: { email: '   ' } }],
      name: 'Frostbite Regatta',
      paymentDeadlineAt: new Date('2026-06-01T11:00:00.000Z'),
      payments: [paymentRow],
    });
    const { processEventPaymentEmailJob } =
      await import('@/worker/eventPaymentEmailJob');

    await processEventPaymentEmailJob({
      dateKey: '2026-06-01',
      eventId: 'event-1',
      kind: 'admin_digest',
    });

    expect(mocks.eventPaymentNotificationUpsert).not.toHaveBeenCalled();
    expect(mocks.sendEventPaymentAdminDigestEmail).not.toHaveBeenCalled();
  });

  it('excludes incomplete payments from admin digest rows', async () => {
    mocks.eventFindUnique.mockResolvedValueOnce({
      admins: [{ admin: { email: 'admin@example.com' } }],
      name: 'Frostbite Regatta',
      paymentDeadlineAt: null,
      payments: [
        paymentRow,
        {
          ...paymentRow,
          id: 'payment-2',
          selectedFeeDescription: null,
        },
      ],
    });
    const { processEventPaymentEmailJob } =
      await import('@/worker/eventPaymentEmailJob');

    await processEventPaymentEmailJob({
      dateKey: '2026-06-01',
      eventId: 'event-1',
      kind: 'admin_digest',
    });

    expect(mocks.sendEventPaymentAdminDigestEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        deadline: 'No deadline',
        overduePayments: [
          expect.objectContaining({
            id: 'payment-1',
            selectedFeeDescription: 'Adult entry',
          }),
        ],
      })
    );
    expect(mocks.eventPaymentNotificationUpsert).toHaveBeenCalledTimes(1);
    expect(mocks.eventPaymentNotificationUpsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paymentId_kind_sentDateKey: expect.objectContaining({
            paymentId: 'payment-2',
          }),
        }),
      })
    );
  });

  it('logs admin digest cleanup failures and rethrows the send failure', async () => {
    const sendError = new Error('send failed');
    const cleanupError = new Error('cleanup failed');
    mocks.eventFindUnique.mockResolvedValueOnce({
      admins: [{ admin: { email: 'admin@example.com' } }],
      name: 'Frostbite Regatta',
      paymentDeadlineAt: new Date('2026-06-01T11:00:00.000Z'),
      payments: [paymentRow],
    });
    mocks.sendEventPaymentAdminDigestEmail.mockRejectedValueOnce(sendError);
    mocks.eventPaymentNotificationUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(cleanupError);
    const { processEventPaymentEmailJob } =
      await import('@/worker/eventPaymentEmailJob');

    await expect(
      processEventPaymentEmailJob({
        dateKey: '2026-06-01',
        eventId: 'event-1',
        kind: 'admin_digest',
      })
    ).rejects.toBe(sendError);

    expect(mocks.loggerError).toHaveBeenCalledWith(
      '[event-payment-email] admin_digest cleanup_failed notification_id={notificationId} error_name={errorName} error_code={errorCode}',
      {
        errorCode: 'unknown',
        errorName: 'Error',
        notificationId: 'notification-1',
      }
    );
  });
});
