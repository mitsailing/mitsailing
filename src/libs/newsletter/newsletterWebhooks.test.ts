import type { WebhookEventPayload } from 'resend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleResendNewsletterWebhook } from '@/libs/newsletter/newsletterWebhooks';

const mocks = vi.hoisted(() => {
  const tx = {
    newsletterDelivery: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    newsletterEvent: {
      create: vi.fn(),
    },
    newsletterSubscriber: {
      updateMany: vi.fn(),
    },
  };

  return {
    prisma: {
      $transaction: vi.fn(
        async (operation: (client: typeof tx) => Promise<void>) => {
          await operation(tx);
        }
      ),
    },
    recordResendEmailMessageEvent: vi.fn(),
    tx,
  };
});

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/libs/email/emailMessages', () => ({
  recordResendEmailMessageEvent: mocks.recordResendEmailMessageEvent,
}));

function baseEmailData() {
  return {
    created_at: '2026-05-14T14:29:59.000Z',
    email_id: 'email_123',
    from: 'MIT Sailing <news@mitsailing.test>',
    subject: 'Spring sailing',
    tags: { newsletter_delivery_id: 'delivery_123' },
    to: ['sailor@example.com'],
  };
}

function deliveredEvent() {
  return {
    created_at: '2026-05-14T14:30:00.000Z',
    data: baseEmailData(),
    type: 'email.delivered',
  } satisfies Extract<WebhookEventPayload, { type: 'email.delivered' }>;
}

function bouncedEvent() {
  return {
    created_at: '2026-05-14T14:30:00.000Z',
    data: {
      ...baseEmailData(),
      bounce: {
        message: 'Mailbox unavailable',
        subType: 'General',
        type: 'Permanent',
      },
    },
    type: 'email.bounced',
  } satisfies Extract<WebhookEventPayload, { type: 'email.bounced' }>;
}

describe('handleResendNewsletterWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordResendEmailMessageEvent.mockResolvedValue(true);
    mocks.tx.newsletterDelivery.findFirst.mockResolvedValue({
      broadcastId: 'broadcast_123',
      email: 'sailor@example.com',
      id: 'delivery_123',
      primaryListId: 'list_123',
      subscriberId: 'subscriber_123',
    });
    mocks.tx.newsletterDelivery.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.newsletterEvent.create.mockResolvedValue({ id: 'event_123' });
    mocks.tx.newsletterSubscriber.updateMany.mockResolvedValue({ count: 1 });
  });

  it('skips duplicate svix events transactionally', async () => {
    mocks.recordResendEmailMessageEvent.mockResolvedValueOnce(false);

    await handleResendNewsletterWebhook(deliveredEvent(), {
      providerEventId: 'svix_123',
    });

    expect(mocks.recordResendEmailMessageEvent).toHaveBeenCalledWith(
      expect.objectContaining({ providerEventId: 'svix_123' })
    );
    expect(mocks.tx.newsletterDelivery.findFirst).not.toHaveBeenCalled();
    expect(mocks.tx.newsletterDelivery.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.newsletterEvent.create).not.toHaveBeenCalled();
  });

  it('guards terminal failures from older delivered events', async () => {
    await handleResendNewsletterWebhook(deliveredEvent(), {
      providerEventId: 'svix_123',
      skipDedupe: true,
    });

    expect(mocks.tx.newsletterDelivery.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deliveredAt: new Date('2026-05-14T14:30:00.000Z'),
        status: 'delivered',
      }),
      where: {
        id: 'delivery_123',
        OR: [
          {
            status: {
              notIn: [
                'delivered',
                'bounced',
                'complained',
                'failed',
                'suppressed',
                'cancelled',
              ],
            },
          },
          {
            deliveredAt: { lte: new Date('2026-05-14T14:30:00.000Z') },
            status: 'delivered',
          },
        ],
      },
    });
  });

  it('suppresses subscribers with event timestamps', async () => {
    await handleResendNewsletterWebhook(bouncedEvent(), {
      providerEventId: 'svix_123',
      skipDedupe: true,
    });

    expect(mocks.tx.newsletterSubscriber.updateMany).toHaveBeenCalledWith({
      data: {
        suppressedAt: new Date('2026-05-14T14:30:00.000Z'),
        suppressionReason: 'bounced',
      },
      where: {
        id: 'subscriber_123',
        OR: [
          { suppressedAt: null },
          { suppressedAt: { lte: new Date('2026-05-14T14:30:00.000Z') } },
        ],
      },
    });
    expect(mocks.tx.newsletterEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdAt: new Date('2026-05-14T14:30:00.000Z'),
        metadata: expect.objectContaining({ providerEventId: 'svix_123' }),
        type: 'bounced',
      }),
    });
  });
});
