import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique, update, updateMany } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    user: {
      findUnique,
      update,
      updateMany,
    },
  },
}));

vi.mock('@/libs/email/sendTransactional', () => ({
  sendTransactionalEmail: vi.fn(),
}));

vi.mock('@/libs/auth/unlock-token', () => ({
  createUnlockAccountToken: vi.fn().mockResolvedValue('fake-signed-jwt-token'),
}));

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue({ unconfirmedEmail: null });
  update.mockResolvedValue({});
  updateMany.mockResolvedValue({ count: 1 });
});

describe('account email notices', () => {
  it('security-notice persona receives a verification code email', async () => {
    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');
    const { sendEmailOtpCode } = await import('@/libs/email/account-emails');

    await sendEmailOtpCode({
      email: 'new-sailor@example.com',
      otp: '123456',
      type: 'email-verification',
    });

    const [payload] = vi.mocked(sendTransactionalEmail).mock.calls[0] ?? [];

    expect(payload?.to).toBe('new-sailor@example.com');
    expect(payload?.subject).toMatch(/confirm/i);
    expect(payload?.text).toContain('verification code is 123456');
    expect(payload?.html).toContain('Thanks for signing up');
  });

  it('interpolates every sign-in OTP text code token', async () => {
    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');
    const { sendEmailOtpCode } = await import('@/libs/email/account-emails');

    await sendEmailOtpCode({
      email: 'returning@example.com',
      otp: '123456',
      type: 'sign-in',
    });

    const [payload] = vi.mocked(sendTransactionalEmail).mock.calls[0] ?? [];

    expect(payload?.text).toContain('sign-in code is 123456');
    expect(payload?.text).not.toContain('{code}');
  });

  it('returning sailor receives sign-in OTP copy, not sign-up verification copy', async () => {
    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');
    const { sendEmailOtpCode } = await import('@/libs/email/account-emails');

    await sendEmailOtpCode({
      email: 'returning@example.com',
      otp: '111222',
      type: 'sign-in',
    });

    const [payload] = vi.mocked(sendTransactionalEmail).mock.calls[0] ?? [];

    expect(payload?.to).toBe('returning@example.com');
    expect(payload?.subject).toMatch(/sign-in/i);
    expect(payload?.text).toContain('sign-in code is 111222');
    expect(payload?.html).toContain('Sign in with your code');
    expect(payload?.html).not.toContain('Thanks for signing up');
    expect(payload?.html).not.toContain('activate your account');
  });

  it('security-notice persona receives a password reset code email', async () => {
    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');
    const { sendEmailOtpCode } = await import('@/libs/email/account-emails');

    await sendEmailOtpCode({
      email: 'reset@example.com',
      otp: '654321',
      type: 'forget-password',
    });

    const [payload] = vi.mocked(sendTransactionalEmail).mock.calls[0] ?? [];

    expect(payload?.to).toBe('reset@example.com');
    expect(payload?.subject).toMatch(/reset/i);
    expect(payload?.text).toContain('password reset code is 654321');
  });

  it('email-change persona receives a confirmation code at the new email', async () => {
    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');
    const { sendEmailOtpCode } = await import('@/libs/email/account-emails');

    await sendEmailOtpCode({
      email: 'next@example.com',
      otp: '987654',
      type: 'change-email',
    });

    const [payload] = vi.mocked(sendTransactionalEmail).mock.calls[0] ?? [];

    expect(payload?.to).toBe('next@example.com');
    expect(payload?.subject).toMatch(/new email/i);
    expect(payload?.text).toContain('email change confirmation code is 987654');
  });

  it('throws when an unsupported OTP type reaches the exhaustive branch', async () => {
    const { sendEmailOtpCode } = await import('@/libs/email/account-emails');
    type SendEmailOtpParams = Parameters<typeof sendEmailOtpCode>[0];

    await expect(
      sendEmailOtpCode({
        email: 'x@example.com',
        otp: '123456',
        type:
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- deliberate runtime invalid union member for exhaustive switch coverage
          'unsupported-runtime-type' as unknown as SendEmailOtpParams['type'],
      })
    ).rejects.toThrow(/Unsupported email OTP type/);
  });

  it('email-change persona records when the pending email changes', async () => {
    const { markPendingEmailChange } =
      await import('@/libs/email/account-emails');

    await expect(
      markPendingEmailChange({
        newEmail: 'next@example.com',
        userId: 'user_123',
      })
    ).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledWith({
      data: { unconfirmedEmail: 'next@example.com' },
      where: {
        OR: [
          { unconfirmedEmail: null },
          { unconfirmedEmail: { not: 'next@example.com' } },
        ],
        id: 'user_123',
      },
    });
  });

  it('email-change persona keeps resend state when pending email is unchanged', async () => {
    const { markPendingEmailChange } =
      await import('@/libs/email/account-emails');

    updateMany.mockResolvedValue({ count: 0 });

    await expect(
      markPendingEmailChange({
        newEmail: 'next@example.com',
        userId: 'user_123',
      })
    ).resolves.toBe(false);

    expect(updateMany).toHaveBeenCalledWith({
      data: { unconfirmedEmail: 'next@example.com' },
      where: {
        OR: [
          { unconfirmedEmail: null },
          { unconfirmedEmail: { not: 'next@example.com' } },
        ],
        id: 'user_123',
      },
    });
  });

  it('security-notice persona receives a change-request notice at the current email', async () => {
    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');
    const { Env } = await import('@/libs/Env');
    const { sendEmailChangeRequestedNotice } =
      await import('@/libs/email/account-emails');

    await sendEmailChangeRequestedNotice({
      currentEmail: 'current@example.com',
      newEmail: 'next@example.com',
    });

    const [payload] = vi.mocked(sendTransactionalEmail).mock.calls[0] ?? [];

    expect(payload?.to).toBe('current@example.com');
    expect(payload?.subject).toMatch(/email change requested/i);
    expect(payload?.html).toContain('next@example.com');
    expect(payload?.text).toContain('next@example.com');
    expect(payload?.text).toContain(Env.SUPPORT_EMAIL);
  });

  it('security-notice persona receives the delete-account confirmation email', async () => {
    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');
    const { sendDeleteAccountVerificationEmail } =
      await import('@/libs/email/account-emails');

    await sendDeleteAccountVerificationEmail(
      'owner@example.com',
      'https://example.test/delete'
    );

    const [payload] = vi.mocked(sendTransactionalEmail).mock.calls[0] ?? [];

    expect(payload?.to).toBe('owner@example.com');
    expect(payload?.subject).toMatch(/account deletion/i);
    expect(payload?.html).toContain('https://example.test/delete');
  });

  it('locked-out sailor receives an unlock URL with a signed token', async () => {
    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');
    const { sendAccountLockedEmail } =
      await import('@/libs/email/account-emails');

    await sendAccountLockedEmail('locked-user@example.com');

    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
    const [payload] = vi.mocked(sendTransactionalEmail).mock.calls[0] ?? [];

    expect(payload).toBeDefined();
    if (!payload) {
      return;
    }

    expect(payload.to).toBe('locked-user@example.com');
    expect(payload.subject).toBeTruthy();

    // The email body must contain the unlock URL for the one-click flow.
    // We check a few properties rather than a brittle exact-string match:
    //   - the route path is /api/unlock-account (not a generic sign-in link)
    //   - the token query param is present and URL-encoded
    //   - the URL is absolute (starts with the configured base URL), so the
    //     link still works when the email is opened outside the origin
    expect(payload.html).toMatch(/\/api\/unlock-account\?token=/);
    expect(payload.html).toMatch(/fake-signed-jwt-token/);
    expect(payload.html).toMatch(/https?:\/\//);
  });

  it('security-notice persona receives a password-changed notice', async () => {
    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');
    const { sendPasswordChangedNotice } =
      await import('@/libs/email/account-emails');

    await sendPasswordChangedNotice('owner@example.com');

    const [payload] = vi.mocked(sendTransactionalEmail).mock.calls[0] ?? [];

    expect(payload?.to).toBe('owner@example.com');
    expect(payload?.subject).toMatch(/password was changed/i);
  });
});
