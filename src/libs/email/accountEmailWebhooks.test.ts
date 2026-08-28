import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleResendAccountEmailWebhook } from '@/libs/email/accountEmailWebhooks';
import {
  buildResendBouncedWebhookEvent,
  buildResendComplainedWebhookEvent,
} from '@/libs/email/resendWebhookTestFixtures';

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

describe('handleResendAccountEmailWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.user.updateMany.mockResolvedValue({ count: 1 });
  });

  it('records bounces without marking the account suppressed', async () => {
    await handleResendAccountEmailWebhook(buildResendBouncedWebhookEvent());

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
    await handleResendAccountEmailWebhook(buildResendComplainedWebhookEvent());

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

    await handleResendAccountEmailWebhook(buildResendBouncedWebhookEvent(), {
      client,
      providerEventId: null,
    });

    expect(client.user.updateMany).toHaveBeenCalledOnce();
    expect(mocks.prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('skips malformed email events without recipients', async () => {
    const event = buildResendBouncedWebhookEvent();
    Reflect.deleteProperty(event.data, 'to');

    await handleResendAccountEmailWebhook(event);

    expect(mocks.prisma.user.updateMany).not.toHaveBeenCalled();
  });
});
