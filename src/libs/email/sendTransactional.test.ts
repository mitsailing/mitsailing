import { beforeEach, describe, expect, it, vi } from 'vitest';

type MailTransport = 'smtp' | 'resend' | 'log' | 'unknown';

type EnvMock = {
  MAIL_TRANSPORT: MailTransport;
  SMTP_URL?: string;
  EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
};

const mocks = vi.hoisted(() => {
  const env: EnvMock = { MAIL_TRANSPORT: 'log' };
  const sendMail = vi.fn();
  const createTransport = vi.fn(() => ({ sendMail }));
  const resendSend = vi.fn();
  const Resend = vi.fn(function Resend() {
    return { emails: { send: resendSend } };
  });
  const logger = {
    error: vi.fn(),
    info: vi.fn(),
  };
  const recordSentEmailMessage = vi.fn();

  return {
    createTransport,
    env,
    logger,
    recordSentEmailMessage,
    Resend,
    resendSend,
    sendMail,
  };
});

vi.mock('server-only', () => ({}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mocks.createTransport,
  },
}));

vi.mock('resend', () => ({
  Resend: mocks.Resend,
}));

vi.mock('@/libs/Env', () => ({
  Env: mocks.env,
}));

vi.mock('@/libs/Logger', () => ({
  logger: mocks.logger,
}));

vi.mock('@/libs/email/emailMessages', () => ({
  recordSentEmailMessage: mocks.recordSentEmailMessage,
}));

const message = {
  html: '<p>Hello sailor</p>',
  replyTo: 'sailor@mit.edu',
  subject: 'Account notice',
  text: 'Hello sailor',
  to: 'sailor@example.com',
};

async function sendWithEnv(env: EnvMock) {
  Object.assign(mocks.env, {
    EMAIL_FROM: undefined,
    MAIL_TRANSPORT: 'log' satisfies MailTransport,
    RESEND_API_KEY: undefined,
    SMTP_URL: undefined,
  });
  Object.assign(mocks.env, env);

  const { sendTransactionalEmail } =
    await import('@/libs/email/sendTransactional');

  return sendTransactionalEmail(message);
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.recordSentEmailMessage.mockResolvedValue('email_message_123');
  mocks.sendMail.mockResolvedValue({});
  mocks.resendSend.mockResolvedValue({ data: { id: 'email_123' } });
});

describe('sendTransactionalEmail', () => {
  it('logs email details when transport is log', async () => {
    await sendWithEnv({ MAIL_TRANSPORT: 'log' });

    expect(mocks.logger.info).toHaveBeenCalledWith(
      '[mail:log] → sailor@example.com — Account notice'
    );
    expect(mocks.recordSentEmailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'other',
        provider: 'log',
        providerMessageId: null,
        subject: 'Account notice',
        toEmail: 'sailor@example.com',
      })
    );
    expect(mocks.createTransport).not.toHaveBeenCalled();
    expect(mocks.Resend).not.toHaveBeenCalled();
  });

  it('requires an email sender before using smtp', async () => {
    await expect(
      sendWithEnv({
        MAIL_TRANSPORT: 'smtp',
        SMTP_URL: 'smtp://127.0.0.1:1025',
      })
    ).rejects.toThrow('MAIL_TRANSPORT=smtp but EMAIL_FROM is not set.');

    expect(mocks.createTransport).not.toHaveBeenCalled();
  });

  it('requires an smtp url before creating a transport', async () => {
    await expect(
      sendWithEnv({
        EMAIL_FROM: 'MIT Sailing <noreply@example.com>',
        MAIL_TRANSPORT: 'smtp',
      })
    ).rejects.toThrow('MAIL_TRANSPORT=smtp but SMTP_URL is not set.');

    expect(mocks.createTransport).not.toHaveBeenCalled();
  });

  it('sends smtp email through a cached transport', async () => {
    Object.assign(mocks.env, {
      EMAIL_FROM: 'MIT Sailing <noreply@example.com>',
      MAIL_TRANSPORT: 'smtp' satisfies MailTransport,
      RESEND_API_KEY: undefined,
      SMTP_URL: 'smtp://127.0.0.1:1025',
    });

    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');

    await sendTransactionalEmail(message);
    await sendTransactionalEmail({
      ...message,
      subject: 'Second notice',
    });

    expect(mocks.createTransport).toHaveBeenCalledTimes(1);
    expect(mocks.createTransport).toHaveBeenCalledWith('smtp://127.0.0.1:1025');
    expect(mocks.sendMail).toHaveBeenCalledTimes(2);
    expect(mocks.recordSentEmailMessage).toHaveBeenCalledTimes(2);
    expect(mocks.sendMail).toHaveBeenCalledWith({
      from: 'MIT Sailing <noreply@example.com>',
      html: '<p>Hello sailor</p>',
      replyTo: 'sailor@mit.edu',
      subject: 'Account notice',
      text: 'Hello sailor',
      to: 'sailor@example.com',
    });
  });

  it('generates plaintext fallback when text is omitted', async () => {
    Object.assign(mocks.env, {
      EMAIL_FROM: 'MIT Sailing <noreply@example.com>',
      MAIL_TRANSPORT: 'smtp' satisfies MailTransport,
      RESEND_API_KEY: undefined,
      SMTP_URL: 'smtp://127.0.0.1:1025',
    });

    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');

    await sendTransactionalEmail({
      html: '<p>Hello&nbsp;<strong>sailor</strong></p><p><a href="https://example.com/account">Account</a></p>',
      subject: 'Account notice',
      to: 'sailor@example.com',
    });

    expect(mocks.sendMail).toHaveBeenCalledWith({
      from: 'MIT Sailing <noreply@example.com>',
      html: '<p>Hello&nbsp;<strong>sailor</strong></p><p><a href="https://example.com/account">Account</a></p>',
      subject: 'Account notice',
      text: 'Hello sailor\n\nAccount (https://example.com/account)',
      to: 'sailor@example.com',
    });
  });

  it('requires resend credentials before sending', async () => {
    await expect(
      sendWithEnv({
        EMAIL_FROM: 'MIT Sailing <noreply@example.com>',
        MAIL_TRANSPORT: 'resend',
      })
    ).rejects.toThrow(
      'MAIL_TRANSPORT=resend requires both RESEND_API_KEY and EMAIL_FROM.'
    );

    await expect(
      sendWithEnv({
        MAIL_TRANSPORT: 'resend',
        RESEND_API_KEY: 're_test',
      })
    ).rejects.toThrow(
      'MAIL_TRANSPORT=resend requires both RESEND_API_KEY and EMAIL_FROM.'
    );
  });

  it('sends resend email through the api client', async () => {
    await sendWithEnv({
      EMAIL_FROM: 'MIT Sailing <noreply@example.com>',
      MAIL_TRANSPORT: 'resend',
      RESEND_API_KEY: 're_test',
    });

    expect(mocks.Resend).toHaveBeenCalledWith('re_test');
    expect(mocks.resendSend).toHaveBeenCalledWith({
      from: 'MIT Sailing <noreply@example.com>',
      html: '<p>Hello sailor</p>',
      replyTo: 'sailor@mit.edu',
      subject: 'Account notice',
      text: 'Hello sailor',
      to: 'sailor@example.com',
    });
    expect(mocks.recordSentEmailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'resend',
        providerMessageId: 'email_123',
      })
    );
  });

  it('does not fail delivery when email ledger recording fails', async () => {
    mocks.recordSentEmailMessage.mockRejectedValueOnce(new Error('db down'));

    await expect(
      sendWithEnv({
        EMAIL_FROM: 'MIT Sailing <noreply@example.com>',
        MAIL_TRANSPORT: 'resend',
        RESEND_API_KEY: 're_test',
      })
    ).resolves.toEqual({ providerMessageId: 'email_123' });

    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Failed to record outbound email message: {error}',
      expect.objectContaining({ error: expect.any(Error) })
    );
  });

  it('logs and throws resend delivery errors', async () => {
    mocks.resendSend.mockResolvedValue({
      error: { message: 'Domain is not verified' },
    });

    await expect(
      sendWithEnv({
        EMAIL_FROM: 'MIT Sailing <noreply@example.com>',
        MAIL_TRANSPORT: 'resend',
        RESEND_API_KEY: 're_test',
      })
    ).rejects.toThrow('Domain is not verified');

    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Resend error: Domain is not verified'
    );
    expect(mocks.recordSentEmailMessage).not.toHaveBeenCalled();
  });

  it('throws when an unknown transport reaches the exhaustive branch', async () => {
    await expect(sendWithEnv({ MAIL_TRANSPORT: 'unknown' })).rejects.toThrow(
      'Unknown MAIL_TRANSPORT: unknown'
    );
  });
});
