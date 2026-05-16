import * as Sentry from '@sentry/nextjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncSentryUserFromSession } from '@/libs/sentry-user-server';

vi.mock('server-only', () => ({}));

vi.mock('@sentry/nextjs', () => ({
  setUser: vi.fn(),
}));

describe('syncSentryUserFromSession', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DISABLED', '');
    vi.mocked(Sentry.setUser).mockClear();
  });

  it('passes signed-in identity with email', () => {
    syncSentryUserFromSession({
      user: {
        email: 'sailor@example.com',
        id: 'user-1',
      },
    });

    expect(Sentry.setUser).toHaveBeenCalledWith({
      email: 'sailor@example.com',
      id: 'user-1',
    });
  });

  it('clears identity without a user id', () => {
    syncSentryUserFromSession({ user: { email: 'sailor@example.com' } });

    expect(Sentry.setUser).toHaveBeenCalledWith(null);
  });

  it('skips identity sync when Sentry is disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DISABLED', '1');

    syncSentryUserFromSession({
      user: {
        email: 'sailor@example.com',
        id: 'user-1',
      },
    });

    expect(Sentry.setUser).not.toHaveBeenCalled();
  });
});
