import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique, headers, loggerWarn, requestPasswordResetEmailOTP } =
  vi.hoisted(() => ({
    findUnique: vi.fn(),
    headers: vi.fn(() => new Headers({ 'x-test': '1' })),
    loggerWarn: vi.fn(),
    requestPasswordResetEmailOTP: vi.fn(),
  }));

vi.mock('server-only', () => ({}));

vi.mock('next/headers', () => ({
  headers,
}));

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      requestPasswordResetEmailOTP,
    },
  },
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    user: {
      findUnique,
    },
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    warn: loggerWarn,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue(null);
  requestPasswordResetEmailOTP.mockResolvedValue({ success: true });
});

describe('signInEmailActions', () => {
  it('reject invalid email before lookup', async () => {
    const { resolveSignInEmailAction } =
      await import('@/libs/auth/signInEmailActions');

    await expect(
      resolveSignInEmailAction({ email: 'sailor@mit' })
    ).resolves.toEqual({ state: 'invalid_email' });

    expect(findUnique).not.toHaveBeenCalled();
    expect(requestPasswordResetEmailOTP).not.toHaveBeenCalled();
  });

  it('route unknown email to sign up', async () => {
    const { resolveSignInEmailAction } =
      await import('@/libs/auth/signInEmailActions');

    await expect(
      resolveSignInEmailAction({ email: ' New@MIT.EDU ' })
    ).resolves.toEqual({ email: 'new@mit.edu', state: 'sign_up' });

    expect(findUnique).toHaveBeenCalledWith({
      where: { email: 'new@mit.edu' },
      select: {
        accounts: {
          select: { id: true },
          take: 1,
          where: { password: { not: null }, providerId: 'credential' },
        },
      },
    });
  });

  it('allow password sign in for active password users', async () => {
    findUnique.mockResolvedValue({ accounts: [{ id: 'account-1' }] });
    const { resolveSignInEmailAction } =
      await import('@/libs/auth/signInEmailActions');

    await expect(
      resolveSignInEmailAction({ email: 'active@mit.edu' })
    ).resolves.toEqual({ email: 'active@mit.edu', state: 'password' });

    expect(requestPasswordResetEmailOTP).not.toHaveBeenCalled();
  });

  it('send reset code for reset-required users', async () => {
    findUnique.mockResolvedValue({ accounts: [] });
    const { resolveSignInEmailAction } =
      await import('@/libs/auth/signInEmailActions');

    await expect(
      resolveSignInEmailAction({ email: 'legacy@mit.edu' })
    ).resolves.toEqual({ email: 'legacy@mit.edu', state: 'reset_required' });

    expect(requestPasswordResetEmailOTP).toHaveBeenCalledWith({
      body: { email: 'legacy@mit.edu' },
      headers: expect.any(Headers),
    });
  });

  it('report reset delivery failure without revealing backend text', async () => {
    findUnique.mockResolvedValue({ accounts: [] });
    requestPasswordResetEmailOTP.mockRejectedValue(new Error('smtp down'));
    const { resolveSignInEmailAction } =
      await import('@/libs/auth/signInEmailActions');

    await expect(
      resolveSignInEmailAction({ email: 'legacy@mit.edu' })
    ).resolves.toEqual({ email: 'legacy@mit.edu', state: 'reset_failed' });

    expect(loggerWarn).toHaveBeenCalledWith(
      'Failed to send password reset email OTP for user sign-in',
      {
        email: 'legacy@mit.edu',
        errorMessage: 'smtp down',
        errorName: 'Error',
      }
    );
  });

  it('log string reset delivery failure safely', async () => {
    findUnique.mockResolvedValue({ accounts: [] });
    requestPasswordResetEmailOTP.mockRejectedValue('smtp down');
    const { resolveSignInEmailAction } =
      await import('@/libs/auth/signInEmailActions');

    await expect(
      resolveSignInEmailAction({ email: 'legacy@mit.edu' })
    ).resolves.toEqual({ email: 'legacy@mit.edu', state: 'reset_failed' });

    expect(loggerWarn).toHaveBeenCalledWith(
      'Failed to send password reset email OTP for user sign-in',
      {
        email: 'legacy@mit.edu',
        errorMessage: 'smtp down',
        errorName: 'string',
      }
    );
  });

  it('log unknown reset delivery failure safely', async () => {
    findUnique.mockResolvedValue({ accounts: [] });
    requestPasswordResetEmailOTP.mockRejectedValue({ code: 'SMTP_DOWN' });
    const { resolveSignInEmailAction } =
      await import('@/libs/auth/signInEmailActions');

    await expect(
      resolveSignInEmailAction({ email: 'legacy@mit.edu' })
    ).resolves.toEqual({ email: 'legacy@mit.edu', state: 'reset_failed' });

    expect(loggerWarn).toHaveBeenCalledWith(
      'Failed to send password reset email OTP for user sign-in',
      {
        email: 'legacy@mit.edu',
        errorMessage: 'Unknown password reset email request failure',
        errorName: 'object',
      }
    );
  });
});
