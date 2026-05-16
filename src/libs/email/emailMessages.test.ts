import type { WebhookEventPayload } from 'resend';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    emailMessageEvent: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('server-only', () => ({}));

vi.mock('@/generated/prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    }),
  },
}));

vi.mock('@/libs/DB', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

function capturedSql() {
  const [strings] = mocks.prisma.$queryRaw.mock.calls.at(0) ?? [];
  if (!Array.isArray(strings)) {
    throw new TypeError('Expected queryRaw to receive a tagged SQL template.');
  }
  return strings.join(' ');
}

describe('email messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$executeRaw.mockResolvedValue(0);
    mocks.prisma.$queryRaw.mockResolvedValue([{ id: 'email_message_1' }]);
    mocks.prisma.emailMessageEvent.create.mockResolvedValue({});
    mocks.prisma.user.findUnique.mockResolvedValue(null);
  });

  it('preserves last webhook state on duplicate send records', async () => {
    const { recordSentEmailMessage } =
      await import('@/libs/email/emailMessages');

    await recordSentEmailMessage({
      category: 'newsletter',
      newsletterBroadcastId: 'broadcast_1',
      newsletterDeliveryId: 'delivery_1',
      newsletterSubscriberId: 'subscriber_1',
      provider: 'resend',
      providerMessageId: 'message_1',
      subject: 'Spring sailing',
      toEmail: 'Sailor@Example.com',
    });

    const sql = capturedSql();

    expect(sql).toContain('ON CONFLICT ("provider", "provider_message_id")');
    expect(sql).not.toContain('"last_event_type" = \'email.sent\'');
    expect(sql).not.toContain('"last_event_at" = EXCLUDED."last_event_at"');
  });

  it('skips Resend email events without valid timestamps', async () => {
    const { handleResendEmailMessageWebhook } =
      await import('@/libs/email/emailMessages');

    const result = await handleResendEmailMessageWebhook({
      created_at: 'not-a-date',
      data: {
        created_at: '2026-05-14T14:30:00.000Z',
        email_id: 'message_1',
        from: 'launch@mitsailing.example',
        subject: 'Spring sailing',
        to: ['sailor@example.com'],
      },
      type: 'email.delivered',
    });

    expect(result).toBe(false);
    expect(mocks.prisma.emailMessageEvent.create).not.toHaveBeenCalled();
    expect(mocks.prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('creates unique fallback ids for Resend events without provider ids', async () => {
    const { recordResendEmailMessageEvent } =
      await import('@/libs/email/emailMessages');
    const event = {
      created_at: '2026-05-14T14:30:00.000Z',
      data: {
        created_at: '2026-05-14T14:29:59.000Z',
        email_id: 'message_1',
        from: 'launch@mitsailing.example',
        subject: 'Spring sailing',
        to: ['sailor@example.com'],
      },
      type: 'email.delivered',
    } satisfies Extract<WebhookEventPayload, { type: 'email.delivered' }>;

    await recordResendEmailMessageEvent({
      emailMessageId: 'email_message_1',
      event,
      occurredAt: new Date('2026-05-14T14:30:00.000Z'),
      providerEventId: null,
      providerMessageId: 'message_1',
    });
    await recordResendEmailMessageEvent({
      emailMessageId: 'email_message_1',
      event,
      occurredAt: new Date('2026-05-14T14:30:00.000Z'),
      providerEventId: null,
      providerMessageId: 'message_1',
    });

    const providerEventIds = mocks.prisma.$queryRaw.mock.calls.map((call) => {
      const providerEventId: unknown = call.at(4);
      if (typeof providerEventId !== 'string') {
        throw new TypeError('Expected provider event id SQL parameter.');
      }
      return providerEventId;
    });
    expect(providerEventIds).toHaveLength(2);
    expect(providerEventIds[0]).toMatch(
      /^message_1:email\.delivered:2026-05-14T14:30:00\.000Z:synthetic:/
    );
    expect(providerEventIds[1]).toMatch(
      /^message_1:email\.delivered:2026-05-14T14:30:00\.000Z:synthetic:/
    );
    expect(providerEventIds[0]).not.toBe(providerEventIds[1]);
  });
});
