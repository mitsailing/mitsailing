import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientMocks = vi.hoisted(() => ({
  adminClient: vi.fn(() => ({ id: 'admin-client-plugin' })),
  createAuthClient: vi.fn((config: { plugins: unknown[] }) => ({
    config,
    id: 'auth-client',
  })),
  emailOTPClient: vi.fn(() => ({ id: 'email-otp-client-plugin' })),
}));

vi.mock('better-auth/client/plugins', () => ({
  adminClient: clientMocks.adminClient,
  emailOTPClient: clientMocks.emailOTPClient,
}));

vi.mock('better-auth/react', () => ({
  createAuthClient: clientMocks.createAuthClient,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('authClient', () => {
  it('registers admin and email OTP client plugins', async () => {
    const { authClient } = await import('@/libs/auth-client');

    expect(authClient).toEqual({
      config: {
        plugins: [
          { id: 'admin-client-plugin' },
          { id: 'email-otp-client-plugin' },
        ],
      },
      id: 'auth-client',
    });
    expect(clientMocks.adminClient).toHaveBeenCalledTimes(1);
    expect(clientMocks.emailOTPClient).toHaveBeenCalledTimes(1);
    expect(clientMocks.createAuthClient).toHaveBeenCalledWith({
      plugins: [
        { id: 'admin-client-plugin' },
        { id: 'email-otp-client-plugin' },
      ],
    });
  });
});
