import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EventPaymentNotificationKind,
  PaymentPurpose,
  PaymentStatus,
  SailingCardType,
} from '@/generated/prisma/enums';

const mocks = vi.hoisted(() => ({
  eventPaymentNotificationUpdateMany: vi.fn(),
  eventPaymentNotificationUpsert: vi.fn(),
  loggerError: vi.fn(),
  paymentFindUnique: vi.fn(),
  sendMembershipPaymentReminderEmail: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    eventPaymentNotification: {
      updateMany: mocks.eventPaymentNotificationUpdateMany,
      upsert: mocks.eventPaymentNotificationUpsert,
    },
    payment: {
      findUnique: mocks.paymentFindUnique,
    },
  },
}));

vi.mock('@/libs/Env', () => ({
  Env: {
    NEXT_PUBLIC_APP_URL: 'https://sailing.mit.edu',
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

vi.mock('@/libs/email/membership-payment-emails', () => ({
  sendMembershipPaymentReminderEmail: mocks.sendMembershipPaymentReminderEmail,
}));

const membershipPayment = {
  amountCents: 7000,
  cardType: SailingCardType.racing,
  cardYear: 2026,
  currency: 'usd',
  id: 'payment-1',
  purpose: PaymentPurpose.membership,
  status: PaymentStatus.pending,
  user: {
    email: 'sailor@example.com',
    id: 'user-1',
  },
};

describe('membership payment reminder job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.paymentFindUnique.mockResolvedValue(membershipPayment);
    mocks.eventPaymentNotificationUpsert.mockResolvedValue({
      id: 'notification-1',
      providerMessageId: null,
    });
    mocks.eventPaymentNotificationUpdateMany.mockResolvedValue({ count: 1 });
    mocks.sendMembershipPaymentReminderEmail.mockResolvedValue({
      providerMessageId: 'email-reminder',
    });
  });

  it('enqueues reminder jobs with stable dedupe ids', async () => {
    const { enqueueMembershipPaymentReminderJob } =
      await import('@/worker/membershipPaymentReminderJob');
    const queue = { add: vi.fn().mockResolvedValue({ id: 'job-1' }) };

    await enqueueMembershipPaymentReminderJob(queue, {
      dateKey: '2026-05-01',
      paymentId: 'payment-1',
    });

    expect(queue.add).toHaveBeenCalledWith(
      'membership-payment-reminder',
      {
        dateKey: '2026-05-01',
        paymentId: 'payment-1',
      },
      expect.objectContaining({
        jobId: 'membership-payment-reminder-payment-1-2026-05-01',
      })
    );
  });

  it('sends one onboarding reminder for an unpaid membership payment', async () => {
    const { processMembershipPaymentReminderJob } =
      await import('@/worker/membershipPaymentReminderJob');

    await processMembershipPaymentReminderJob({
      dateKey: '2026-05-01',
      paymentId: 'payment-1',
    });

    expect(mocks.eventPaymentNotificationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          kind: EventPaymentNotificationKind.reminder,
          paymentId: 'payment-1',
          sentDateKey: '2026-05-01',
        }),
      })
    );
    expect(mocks.sendMembershipPaymentReminderEmail).toHaveBeenCalledWith({
      amount: '$70.00',
      cardType: 'racing',
      cardYear: 2026,
      emailDedupeKey: 'payment-1:2026-05-01',
      onboardingUrl: 'https://sailing.mit.edu/onboarding',
      paymentId: 'payment-1',
      recipientEmail: 'sailor@example.com',
      userId: 'user-1',
    });
    expect(mocks.eventPaymentNotificationUpdateMany).toHaveBeenLastCalledWith({
      data: { providerMessageId: 'email-reminder' },
      where: {
        id: 'notification-1',
        providerMessageId: expect.stringMatching(/^claim:/u),
      },
    });
  });

  it('skips paid membership payments', async () => {
    mocks.paymentFindUnique.mockResolvedValue({
      ...membershipPayment,
      status: PaymentStatus.paid,
    });
    const { processMembershipPaymentReminderJob } =
      await import('@/worker/membershipPaymentReminderJob');

    await processMembershipPaymentReminderJob({
      dateKey: '2026-05-01',
      paymentId: 'payment-1',
    });

    expect(mocks.sendMembershipPaymentReminderEmail).not.toHaveBeenCalled();
  });
});
