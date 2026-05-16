import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
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
  sentry: {
    captureException: vi.fn(),
  },
  verify: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('resend', () => ({
  Resend: vi.fn(function Resend() {
    return {
      webhooks: { verify: mocks.verify },
    };
  }),
}));

vi.mock('@sentry/nextjs', () => mocks.sentry);

vi.mock('@/libs/Env', () => ({
  Env: mocks.env,
}));

vi.mock('@/libs/Logger', () => ({
  logger: mocks.logger,
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

function webhookRequest() {
  return new Request('https://mitsailing.test/api/resend/webhooks', {
    body: '{"type":"email.delivered"}',
    headers: {
      'svix-id': 'event_123',
      'svix-signature': 'sig_123',
      'svix-timestamp': '2026-05-14T14:30:00.000Z',
    },
    method: 'POST',
  });
}

describe('resend webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(mocks.sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error)
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
      { providerEventId: 'event_123', skipDedupe: true }
    );
    expect(mocks.handleResendAccountEmailWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email.delivered' }),
      { providerEventId: 'event_123' }
    );
    expect(mocks.handleResendEmailMessageWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email.delivered' }),
      { providerEventId: 'event_123' }
    );
  });

  it('lets replayable handlers run before duplicate svix ids are recorded', async () => {
    mocks.handleResendEmailMessageWebhook.mockResolvedValueOnce(false);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(mocks.handleResendNewsletterWebhook).toHaveBeenCalled();
    expect(mocks.handleResendAccountEmailWebhook).toHaveBeenCalled();
  });
});
