import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    $queryRaw: vi.fn(),
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
    mocks.prisma.$queryRaw.mockResolvedValue([{ id: 'email_message_1' }]);
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
});
