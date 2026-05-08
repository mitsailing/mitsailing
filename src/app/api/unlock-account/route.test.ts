import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const { deleteMany, verifyUnlockAccountTokenMock } = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  verifyUnlockAccountTokenMock: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    failedLoginAttempt: {
      deleteMany,
    },
  },
}));

vi.mock('@/libs/auth/unlock-token', () => ({
  verifyUnlockAccountToken: verifyUnlockAccountTokenMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  deleteMany.mockResolvedValue({ count: 3 });
  verifyUnlockAccountTokenMock.mockResolvedValue(null);
});

function unlockRequest(token?: string) {
  const url = new URL('https://example.test/api/unlock-account');
  if (token) {
    url.searchParams.set('token', token);
  }
  return new NextRequest(url);
}

describe('GET /api/unlock-account', () => {
  it('locked-out sailor returns to sign-in when the unlock token is missing', async () => {
    const response = await GET(unlockRequest());

    expect(response.headers.get('location')).toMatch(
      /\/login\?error=unlock_invalid$/
    );
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('locked-out sailor returns to sign-in when the unlock token is invalid', async () => {
    const response = await GET(unlockRequest('invalid-token'));

    expect(verifyUnlockAccountTokenMock).toHaveBeenCalledWith('invalid-token');
    expect(response.headers.get('location')).toMatch(
      /\/login\?error=unlock_invalid$/
    );
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('locked-out sailor unlocks account with a valid email token', async () => {
    verifyUnlockAccountTokenMock.mockResolvedValue({
      email: 'locked@example.com',
    });

    const response = await GET(unlockRequest('valid-token'));

    expect(deleteMany).toHaveBeenCalledWith({
      where: { email: 'locked@example.com' },
    });
    expect(response.headers.get('location')).toMatch(/\/login\?unlocked=1$/);
  });
});
