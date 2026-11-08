import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/libs/email/sendTransactional', () => ({
  sendTransactionalEmail: vi.fn(),
}));

vi.mock('@/libs/auth/unlock-token', () => ({
  createUnlockAccountToken: vi.fn().mockResolvedValue('fake-signed-jwt-token'),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('account email notices', () => {
  it('security-notice persona receives a verification link email', async () => {
    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');
    const { sendEmailVerificationLink } =
      await import('@/libs/email/account-emails');

    await sendEmailVerificationLink({
      email: 'new-sailor@example.com',
      purpose: 'verify-email',
      url: 'https://example.test/api/auth/verify-email?token=abc',
    });

    const [payload] = vi.mocked(sendTransactionalEmail).mock.calls[0] ?? [];

    expect(payload?.to).toBe('new-sailor@example.com');
    expect(payload?.subject).toMatch(/confirm/i);
    expect(payload?.text).toContain(
      'https://example.test/api/auth/verify-email?token=abc'
    );
    expect(payload?.html).toContain(
      'https://example.test/api/auth/verify-email?token=abc'
    );
    expect(payload?.html).toContain('Thanks for signing up');
  });

  it('email-change persona receives a confirmation link at the new email', async () => {
    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');
    const { sendEmailVerificationLink } =
      await import('@/libs/email/account-emails');

    await sendEmailVerificationLink({
      email: 'next@example.com',
      purpose: 'change-email',
      url: 'https://example.test/api/auth/verify-email?token=def',
    });

    const [payload] = vi.mocked(sendTransactionalEmail).mock.calls[0] ?? [];

    expect(payload?.to).toBe('next@example.com');
    expect(payload?.subject).toMatch(/new email/i);
    expect(payload?.text).toContain(
      'https://example.test/api/auth/verify-email?token=def'
    );
    expect(payload?.html).toContain('Confirm new email');
  });

  it('rejects invalid verification recipients before sending mail', async () => {
    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');
    const { sendEmailVerificationLink } =
      await import('@/libs/email/account-emails');

    await expect(
      sendEmailVerificationLink({
        email: 'not-an-email',
        purpose: 'verify-email',
        url: 'https://example.test/api/auth/verify-email?token=abc',
      })
    ).rejects.toThrow('Expected a valid email address.');

    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it('rejects empty verification urls before sending mail', async () => {
    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');
    const { sendEmailVerificationLink } =
      await import('@/libs/email/account-emails');

    await expect(
      sendEmailVerificationLink({
        email: 'sailor@example.com',
        purpose: 'verify-email',
        url: '   ',
      })
    ).rejects.toThrow('Expected a verification URL.');

    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it('security-notice persona receives a password reset link email', async () => {
    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');
    const { sendPasswordResetLinkEmail } =
      await import('@/libs/email/account-emails');

    await sendPasswordResetLinkEmail(
      'reset@example.com',
      'https://example.test/reset-password?token=abc'
    );

    const [payload] = vi.mocked(sendTransactionalEmail).mock.calls[0] ?? [];

    expect(payload?.to).toBe('reset@example.com');
    expect(payload?.subject).toMatch(/reset/i);
    expect(payload?.text).toContain(
      'https://example.test/reset-password?token=abc'
    );
    expect(payload?.html).toContain(
      'https://example.test/reset-password?token=abc'
    );
  });

  it('security-notice persona receives a delete-account confirmation link', async () => {
    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');
    const { sendDeleteAccountVerificationEmail } =
      await import('@/libs/email/account-emails');

    await sendDeleteAccountVerificationEmail(
      'delete@example.com',
      'https://example.test/api/auth/delete-user/callback?token=abc'
    );

    const [payload] = vi.mocked(sendTransactionalEmail).mock.calls[0] ?? [];

    expect(payload?.to).toBe('delete@example.com');
    expect(payload?.subject).toMatch(/deletion/i);
    expect(payload?.text).toContain(
      'https://example.test/api/auth/delete-user/callback?token=abc'
    );
  });

  it('security-notice persona receives an account-locked unlock link', async () => {
    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');
    const { sendAccountLockedEmail } =
      await import('@/libs/email/account-emails');

    await sendAccountLockedEmail('locked@example.com');

    const [payload] = vi.mocked(sendTransactionalEmail).mock.calls[0] ?? [];

    expect(payload?.to).toBe('locked@example.com');
    expect(payload?.subject).toMatch(/locked/i);
    expect(payload?.text).toContain('/api/unlock-account?token=');
  });

  it('security-notice persona receives a password-changed notice', async () => {
    const { sendTransactionalEmail } =
      await import('@/libs/email/sendTransactional');
    const { sendPasswordChangedNotice } =
      await import('@/libs/email/account-emails');

    await sendPasswordChangedNotice('changed@example.com');

    const [payload] = vi.mocked(sendTransactionalEmail).mock.calls[0] ?? [];

    expect(payload?.to).toBe('changed@example.com');
    expect(payload?.subject).toMatch(/password was changed/i);
  });
});
