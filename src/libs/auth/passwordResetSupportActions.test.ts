import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendTransactionalEmail } = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/email/sendTransactional', () => ({
  sendTransactionalEmail,
}));

beforeEach(() => {
  vi.clearAllMocks();
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
});
