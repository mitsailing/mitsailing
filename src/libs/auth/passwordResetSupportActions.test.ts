import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendTransactionalEmail } = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
}));
const arcjetMocks = vi.hoisted(() => {
  const protect = vi.fn(async (): Promise<{ isDenied: () => boolean }> => {
    await Promise.resolve();
    return {
      isDenied: () => false,
    };
  });
  return {
    fixedWindow: vi.fn((rule: unknown) => rule),
    protect,
    request: vi.fn(async () => {
      await Promise.resolve();
      return { ip: '203.0.113.10' };
    }),
    withRule: vi.fn(() => ({ protect })),
  };
});
const envMock = vi.hoisted(() => ({
  Env: {
    ARCJET_KEY: undefined as string | undefined,
  },
}));

vi.mock('server-only', () => ({}));

vi.mock('@arcjet/next', () => ({
  fixedWindow: arcjetMocks.fixedWindow,
  request: arcjetMocks.request,
}));

vi.mock('@/libs/Arcjet', () => ({
  default: {
    withRule: arcjetMocks.withRule,
  },
}));

vi.mock('@/libs/email/sendTransactional', () => ({
  sendTransactionalEmail,
}));

vi.mock('@/libs/Env', () => envMock);

beforeEach(() => {
  vi.clearAllMocks();
  envMock.Env.ARCJET_KEY = undefined;
  arcjetMocks.protect.mockResolvedValue({ isDenied: () => false });
  sendTransactionalEmail.mockResolvedValue({ providerMessageId: null });
});

describe('passwordResetSupportActions', () => {
  it('send password reset support report to configured owner', async () => {
    const { reportPasswordResetIssueAction } =
      await import('@/libs/auth/passwordResetSupportActions');

    await expect(
      reportPasswordResetIssueAction({ email: ' Sailor+<Test>@MIT.EDU ' })
    ).resolves.toEqual({ ok: true });

    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'other',
        html: expect.stringContaining('sailor+&lt;test&gt;@mit.edu'),
        subject: 'Password reset help requested',
        text: expect.stringContaining('sailor+<test>@mit.edu'),
        to: 'ak@callred.com',
      })
    );
  });

  it('reject invalid support report email', async () => {
    const { reportPasswordResetIssueAction } =
      await import('@/libs/auth/passwordResetSupportActions');

    await expect(
      reportPasswordResetIssueAction({ email: 'sailor@mit' })
    ).resolves.toEqual({ error: 'invalid_email', ok: false });

    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it('returns send failed when support report delivery fails', async () => {
    sendTransactionalEmail.mockRejectedValue(new Error('smtp down'));
    const { reportPasswordResetIssueAction } =
      await import('@/libs/auth/passwordResetSupportActions');

    await expect(
      reportPasswordResetIssueAction({ email: 'sailor@mit.edu' })
    ).resolves.toEqual({ error: 'send_failed', ok: false });
  });

  it('rate-limits repeated support reports before sending email', async () => {
    envMock.Env.ARCJET_KEY = 'ajkey_test';
    arcjetMocks.protect.mockResolvedValue({ isDenied: () => true });
    const { reportPasswordResetIssueAction } =
      await import('@/libs/auth/passwordResetSupportActions');

    await expect(
      reportPasswordResetIssueAction({ email: 'sailor@mit.edu' })
    ).resolves.toEqual({ error: 'rate_limited', ok: false });

    expect(arcjetMocks.request).toHaveBeenCalledOnce();
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });
});
