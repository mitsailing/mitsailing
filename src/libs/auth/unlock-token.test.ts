import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnv = vi.hoisted(() => ({
  BETTER_AUTH_SECRET: 'unlock-secret-with-at-least-thirty-two-chars',
}));

const { signJWT, verifyJWT } = vi.hoisted(() => ({
  signJWT: vi.fn(),
  verifyJWT: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/libs/Env', () => ({ Env: mockEnv }));
vi.mock('better-auth/crypto', () => ({ signJWT, verifyJWT }));

beforeEach(() => {
  signJWT.mockReset();
  verifyJWT.mockReset();
});

describe('createUnlockAccountToken', () => {
  it('locked-out sailor receives a normalized signed unlock payload', async () => {
    signJWT.mockResolvedValue('signed-token');
    const { createUnlockAccountToken } =
      await import('@/libs/auth/unlock-token');

    const token = await createUnlockAccountToken('SAILOR@MIT.EDU');

    expect(token).toBe('signed-token');
    expect(signJWT).toHaveBeenCalledWith(
      { action: 'unlock-account', email: 'sailor@mit.edu' },
      mockEnv.BETTER_AUTH_SECRET,
      60 * 60
    );
  });
});

describe('verifyUnlockAccountToken', () => {
  it('locked-out sailor is identified from a valid unlock payload', async () => {
    verifyJWT.mockResolvedValue({
      action: 'unlock-account',
      email: 'sailor@mit.edu',
    });
    const { verifyUnlockAccountToken } =
      await import('@/libs/auth/unlock-token');

    await expect(verifyUnlockAccountToken('signed-token')).resolves.toEqual({
      email: 'sailor@mit.edu',
    });
    expect(verifyJWT).toHaveBeenCalledWith(
      'signed-token',
      mockEnv.BETTER_AUTH_SECRET
    );
  });

  it.each([
    { name: 'null payload', payload: null },
    {
      name: 'wrong action',
      payload: { action: 'verify-email', email: 'a@b.c' },
    },
    { name: 'missing email', payload: { action: 'unlock-account' } },
    { name: 'empty email', payload: { action: 'unlock-account', email: '' } },
    {
      name: 'non-string email',
      payload: { action: 'unlock-account', email: 123 },
    },
  ])('returns null for $name', async (caseInput) => {
    verifyJWT.mockResolvedValue(caseInput.payload);
    const { verifyUnlockAccountToken } =
      await import('@/libs/auth/unlock-token');

    await expect(verifyUnlockAccountToken('signed-token')).resolves.toBeNull();
  });

  it('locked-out sailor gets no identity from token verify errors', async () => {
    verifyJWT.mockRejectedValue(new Error('invalid signature'));
    const { verifyUnlockAccountToken } =
      await import('@/libs/auth/unlock-token');

    await expect(verifyUnlockAccountToken('signed-token')).resolves.toBeNull();
  });
});
