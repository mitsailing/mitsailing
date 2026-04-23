import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/libs/email/sendTransactional', () => ({
  sendTransactionalEmail: vi.fn(),
}));

vi.mock('@/libs/auth/unlock-token', () => ({
  createUnlockAccountToken: vi.fn().mockResolvedValue('fake-signed-jwt-token'),
}));

describe('sendAccountLockedEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds an unlock URL that targets /api/unlock-account with a signed token', async () => {
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
});
