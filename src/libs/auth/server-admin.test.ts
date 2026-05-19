import { describe, expect, it, vi } from 'vitest';

const authSetRole = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      setRole: authSetRole,
    },
  },
}));

describe('setBetterAuthRoleMirror', () => {
  it('updates Better Auth role mirror with request headers', async () => {
    const requestHeaders = new Headers([['cookie', 'session=abc']]);
    const { setBetterAuthRoleMirror } =
      await import('@/libs/auth/server-admin');

    await setBetterAuthRoleMirror({
      requestHeaders,
      role: 'dock_staff',
      userId: 'user-1',
    });

    expect(authSetRole).toHaveBeenCalledWith({
      body: {
        role: 'dock_staff',
        userId: 'user-1',
      },
      headers: requestHeaders,
    });
  });
});
