import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  captureMessage: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: mocks.captureMessage,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindUnique.mockResolvedValue({ id: 'user-1' });
});

describe('passwordResetSupportActions', () => {
  it('captures support request with matched user context in Sentry', async () => {
    const { reportPasswordResetIssueAction } =
      await import('@/libs/auth/passwordResetSupportActions');

    await expect(
      reportPasswordResetIssueAction({
        action: 'create_password_email_not_received',
        email: ' Sailor+<Test>@MIT.EDU ',
      })
    ).resolves.toEqual({ ok: true });

    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      select: { id: true },
      where: { email: 'sailor+<test>@mit.edu' },
    });
    expect(mocks.captureMessage).toHaveBeenCalledWith(
      'Password reset support requested',
      expect.objectContaining({
        extra: {
          action: 'create_password_email_not_received',
          email: 'sailor+<test>@mit.edu',
          userId: 'user-1',
        },
        level: 'warning',
        tags: {
          action: 'create_password_email_not_received',
          userFound: 'true',
        },
        user: {
          email: 'sailor+<test>@mit.edu',
          id: 'user-1',
        },
      })
    );
  });

  it('captures support request without user id when no account matches', async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    const { reportPasswordResetIssueAction } =
      await import('@/libs/auth/passwordResetSupportActions');

    await expect(
      reportPasswordResetIssueAction({
        action: 'password_reset_email_not_received',
        email: 'unknown@mit.edu',
      })
    ).resolves.toEqual({ ok: true });

    expect(mocks.captureMessage).toHaveBeenCalledWith(
      'Password reset support requested',
      expect.objectContaining({
        extra: {
          action: 'password_reset_email_not_received',
          email: 'unknown@mit.edu',
          userId: null,
        },
        tags: expect.objectContaining({ userFound: 'false' }),
        user: { email: 'unknown@mit.edu' },
      })
    );
  });

  it('rejects invalid support report email', async () => {
    const { reportPasswordResetIssueAction } =
      await import('@/libs/auth/passwordResetSupportActions');

    await expect(
      reportPasswordResetIssueAction({
        action: 'password_reset_email_not_received',
        email: 'sailor@mit',
      })
    ).resolves.toEqual({ error: 'invalid_email', ok: false });

    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.captureMessage).not.toHaveBeenCalled();
  });
});
