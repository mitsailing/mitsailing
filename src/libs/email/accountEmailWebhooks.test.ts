import type { WebhookEventPayload } from 'resend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleResendAccountEmailWebhook } from '@/libs/email/accountEmailWebhooks';

const mocks = vi.hoisted(() => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  prisma: {
    user: {
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/libs/Logger', () => ({
  logger: mocks.logger,
}));

function bouncedEvent() {
  return {
    created_at: '2026-05-14T14:30:00.000Z',
    data: {
      bounce: {
        message: 'Mailbox unavailable',
        subType: 'General',
        type: 'Permanent',
      },
      created_at: '2026-05-14T14:29:59.000Z',
      email_id: 'email_123',
      from: 'MIT Sailing <accounts@mitsailing.test>',
      message_id: '<email_123@mitsailing.test>',
      subject: 'Account notice',
      to: ['Sailor@Example.com'],
    },
    type: 'email.bounced',
  } satisfies Extract<WebhookEventPayload, { type: 'email.bounced' }>;
}

function complainedEvent() {
  return {
    created_at: '2026-05-14T14:30:00.000Z',
    data: {
      created_at: '2026-05-14T14:29:59.000Z',
      email_id: 'email_123',
      from: 'MIT Sailing <accounts@mitsailing.test>',
      message_id: '<email_123@mitsailing.test>',
      subject: 'Account notice',
      to: ['Sailor@Example.com'],
    },
    type: 'email.complained',
  } satisfies Extract<WebhookEventPayload, { type: 'email.complained' }>;
}

describe('handleResendAccountEmailWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.user.updateMany.mockResolvedValue({ count: 1 });
  });

  it('records bounces without marking the account suppressed', async () => {
    await handleResendAccountEmailWebhook(bouncedEvent());

    expect(mocks.prisma.user.updateMany).toHaveBeenCalledWith({
      data: {
        emailBouncedAt: new Date('2026-05-14T14:30:00.000Z'),
        emailSuppressedAt: undefined,
        emailSuppressionReason: undefined,
      },
      where: {
        email: 'sailor@example.com',
        OR: [
          { emailBouncedAt: null },
          { emailBouncedAt: { lte: new Date('2026-05-14T14:30:00.000Z') } },
        ],
      },
    });
  });

  it('guards suppressed account updates by suppression timestamp', async () => {
    await handleResendAccountEmailWebhook(complainedEvent());

    expect(mocks.prisma.user.updateMany).toHaveBeenCalledWith({
      data: {
        emailBouncedAt: undefined,
        emailSuppressedAt: new Date('2026-05-14T14:30:00.000Z'),
        emailSuppressionReason: 'complained',
      },
      where: {
        email: 'sailor@example.com',
        OR: [
          { emailSuppressedAt: null },
          {
            emailSuppressedAt: {
              lte: new Date('2026-05-14T14:30:00.000Z'),
            },
          },
        ],
      },
    });
  });

  it('uses the provided webhook client when processing in a transaction', async () => {
    const client = {
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn(),
      newsletterDelivery: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
      newsletterEvent: {
        create: vi.fn(),
        findFirst: vi.fn(),
      },
      newsletterSubscriber: {
        updateMany: vi.fn(),
      },
      user: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await handleResendAccountEmailWebhook(bouncedEvent(), {
      client,
      providerEventId: null,
    });

    expect(client.user.updateMany).toHaveBeenCalledOnce();
    expect(mocks.prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('skips malformed email events without recipients', async () => {
    const event = bouncedEvent();
    Reflect.deleteProperty(event.data, 'to');

    await handleResendAccountEmailWebhook(event);

    expect(mocks.prisma.user.updateMany).not.toHaveBeenCalled();
  });
});
