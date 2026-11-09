import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientMocks = vi.hoisted(() => ({
  adminClient: vi.fn(() => ({ id: 'admin-client-plugin' })),
  auditLogClient: vi.fn(() => ({ id: 'audit-log-client-plugin' })),
  createAuthClient: vi.fn((config: { plugins: unknown[] }) => ({
    config,
    id: 'auth-client',
  })),
  customSessionClient: vi.fn(() => ({ id: 'custom-session-client-plugin' })),
}));

vi.mock('better-auth/client/plugins', () => ({
  adminClient: clientMocks.adminClient,
  customSessionClient: clientMocks.customSessionClient,
}));

vi.mock('better-auth-audit-logs/client', () => ({
  auditLogClient: clientMocks.auditLogClient,
}));

vi.mock('better-auth/react', () => ({
  createAuthClient: clientMocks.createAuthClient,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('authClient', () => {
  it('registers admin, audit log, and custom session client plugins', async () => {
    const { authClient } = await import('@/libs/auth-client');

    expect(clientMocks.createAuthClient).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({ id: 'admin-client-plugin' }),
          expect.objectContaining({ id: 'audit-log-client-plugin' }),
          expect.objectContaining({ id: 'custom-session-client-plugin' }),
        ]),
      })
    );
    expect(authClient).toEqual(
      expect.objectContaining({
        id: 'auth-client',
        config: expect.objectContaining({
          plugins: expect.arrayContaining([
            expect.objectContaining({ id: 'admin-client-plugin' }),
            expect.objectContaining({ id: 'audit-log-client-plugin' }),
            expect.objectContaining({ id: 'custom-session-client-plugin' }),
          ]),
        }),
      })
    );
    expect(clientMocks.customSessionClient).toHaveBeenCalledOnce();
    expect(clientMocks.auditLogClient).toHaveBeenCalledOnce();
  });
});
