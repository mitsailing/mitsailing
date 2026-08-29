import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => {
  const verify = vi.fn();
  return {
    env: {
      RESEND_API_KEY: 'resend_key',
      RESEND_WEBHOOK_SECRET: 'webhook_secret',
    },
    handleResendAccountEmailWebhook: vi.fn(),
    handleResendEmailMessageWebhook: vi.fn(),
    handleResendNewsletterWebhook: vi.fn(),
    logger: {
      error: vi.fn(),
    },
    prisma: {
      $transaction: vi.fn(
        async (operation: (client: object) => Promise<void>) => {
          await operation({ transaction: true });
        }
      ),
    },
    resend: vi.fn(function Resend() {
      return {
        webhooks: { verify },
      };
    }),
    sentry: {
      captureException: vi.fn(),
    },
    verify,
  };
});

vi.mock('server-only', () => ({}));

vi.mock('resend', () => ({
  Resend: mocks.resend,
}));

vi.mock('@sentry/nextjs', () => mocks.sentry);

vi.mock('@/libs/Env', () => ({
  Env: mocks.env,
}));

vi.mock('@/libs/Logger', () => ({
  logger: mocks.logger,
}));

vi.mock('@/libs/DB', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/libs/email/accountEmailWebhooks', () => ({
  handleResendAccountEmailWebhook: mocks.handleResendAccountEmailWebhook,
}));

vi.mock('@/libs/email/emailMessages', () => ({
  handleResendEmailMessageWebhook: mocks.handleResendEmailMessageWebhook,
}));

vi.mock('@/libs/newsletter/newsletterWebhooks', () => ({
  handleResendNewsletterWebhook: mocks.handleResendNewsletterWebhook,
}));

function webhookRequest(params: { svixId?: string | null } = {}) {
  const headers = new Headers({
    'svix-signature': 'sig_123',
    'svix-timestamp': '2026-05-14T14:30:00.000Z',
  });
  if (params.svixId !== null) {
    headers.set('svix-id', params.svixId ?? 'event_123');
  }

  return new Request('https://mitsailing.test/api/resend/webhooks', {
    body: '{"type":"email.delivered"}',
    headers,
    method: 'POST',
  });
}

describe('resend webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.RESEND_API_KEY = 'resend_key';
    mocks.env.RESEND_WEBHOOK_SECRET = 'webhook_secret';
    mocks.verify.mockReturnValue({
      created_at: '2026-05-14T14:30:00.000Z',
      data: { email_id: 'email_123', to: ['sailor@example.com'] },
      type: 'email.delivered',
    });
    mocks.handleResendEmailMessageWebhook.mockResolvedValue(true);
    mocks.handleResendNewsletterWebhook.mockImplementation(async () => {});
    mocks.handleResendAccountEmailWebhook.mockImplementation(async () => {});
  });

  it('returns unavailable when webhook secret is missing', async () => {
    mocks.env.RESEND_WEBHOOK_SECRET = '';

    const response = await POST(webhookRequest());

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(503);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.handleResendEmailMessageWebhook).not.toHaveBeenCalled();
  });

  it('returns unavailable when resend api key is missing', async () => {
    mocks.env.RESEND_API_KEY = '';

    const response = await POST(webhookRequest());

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(503);
    expect(mocks.resend).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.handleResendEmailMessageWebhook).not.toHaveBeenCalled();
  });

  it('returns bad request for invalid signatures', async () => {
    mocks.verify.mockImplementationOnce(() => {
      throw new Error('invalid');
    });

    const response = await POST(webhookRequest());

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(400);
    expect(mocks.handleResendEmailMessageWebhook).not.toHaveBeenCalled();
    expect(mocks.handleResendNewsletterWebhook).not.toHaveBeenCalled();
    expect(mocks.handleResendAccountEmailWebhook).not.toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Failed to verify Resend webhook: {error}',
      { error: expect.any(Error) }
    );
  });

  it('passes raw payload and svix id to state handlers', async () => {
    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(mocks.verify).toHaveBeenCalledWith({
      headers: {
        id: 'event_123',
        signature: 'sig_123',
        timestamp: '2026-05-14T14:30:00.000Z',
      },
      payload: '{"type":"email.delivered"}',
      webhookSecret: 'webhook_secret',
    });
    expect(mocks.handleResendNewsletterWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email.delivered' }),
      expect.objectContaining({
        providerEventId: 'event_123',
        skipDedupe: true,
      })
    );
    expect(mocks.handleResendAccountEmailWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email.delivered' }),
      expect.objectContaining({ providerEventId: 'event_123' })
    );
    expect(mocks.handleResendEmailMessageWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email.delivered' }),
      expect.objectContaining({ providerEventId: 'event_123' })
    );
    const [emailMessageCallOrder] =
      mocks.handleResendEmailMessageWebhook.mock.invocationCallOrder;
    const [newsletterCallOrder] =
      mocks.handleResendNewsletterWebhook.mock.invocationCallOrder;
    if (!emailMessageCallOrder || !newsletterCallOrder) {
      throw new Error('Expected webhook handlers to be called.');
    }
    expect(emailMessageCallOrder).toBeLessThan(newsletterCallOrder);
  });

  it('derives a shared fallback provider event id without a svix id', async () => {
    mocks.verify.mockReturnValueOnce({
      created_at: '2026-05-14T14:30:00.000Z',
      data: { email_id: 'email_123', to: ['sailor@example.com'] },
      type: 'email.delivered',
    });

    const response = await POST(webhookRequest({ svixId: null }));

    expect(response.status).toBe(200);
    const expectedProviderEventId =
      'email_123:email.delivered:2026-05-14T14:30:00.000Z';
    expect(mocks.handleResendNewsletterWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email.delivered' }),
      expect.objectContaining({ providerEventId: expectedProviderEventId })
    );
    expect(mocks.handleResendEmailMessageWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email.delivered' }),
      expect.objectContaining({ providerEventId: expectedProviderEventId })
    );
  });

  it('derives a shared fallback provider event id with a blank svix id', async () => {
    const response = await POST(webhookRequest({ svixId: '   ' }));

    expect(response.status).toBe(200);
    const expectedProviderEventId =
      'email_123:email.delivered:2026-05-14T14:30:00.000Z';
    expect(mocks.handleResendNewsletterWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email.delivered' }),
      expect.objectContaining({ providerEventId: expectedProviderEventId })
    );
    expect(mocks.handleResendEmailMessageWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email.delivered' }),
      expect.objectContaining({ providerEventId: expectedProviderEventId })
    );
  });

  it('skips downstream handlers for duplicate svix ids', async () => {
    mocks.handleResendEmailMessageWebhook.mockResolvedValueOnce(false);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.handleResendNewsletterWebhook).not.toHaveBeenCalled();
    expect(mocks.handleResendAccountEmailWebhook).not.toHaveBeenCalled();
  });

  it('processes handlers inside one database transaction', async () => {
    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.handleResendNewsletterWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email.delivered' }),
      expect.objectContaining({ client: { transaction: true } })
    );
    expect(mocks.handleResendAccountEmailWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email.delivered' }),
      expect.objectContaining({ client: { transaction: true } })
    );
    expect(mocks.handleResendEmailMessageWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email.delivered' }),
      expect.objectContaining({ client: { transaction: true } })
    );
  });

  it('returns server error when a transaction handler fails', async () => {
    mocks.handleResendAccountEmailWebhook.mockRejectedValueOnce(
      new Error('account failed')
    );

    const response = await POST(webhookRequest());

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(500);
    expect(mocks.handleResendEmailMessageWebhook).toHaveBeenCalled();
    expect(mocks.handleResendNewsletterWebhook).toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Failed to process Resend webhook: {error}',
      expect.objectContaining({
        error: expect.any(Error),
      })
    );
  });

  it('reuses the resend client across webhook requests', async () => {
    await POST(webhookRequest());
    await POST(webhookRequest());

    expect(mocks.resend.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
