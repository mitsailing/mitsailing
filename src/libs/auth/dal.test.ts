import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authGetSession, headers, redirect, syncSentryUserFromSession } =
  vi.hoisted(() => ({
    authGetSession: vi.fn(),
    headers: vi.fn(),
    redirect: vi.fn((href: string) => {
      throw new Error(`NEXT_REDIRECT:${href}`);
    }),
    syncSentryUserFromSession: vi.fn(),
  }));

vi.mock('server-only', () => ({}));

vi.mock('react', () => ({
  cache: <Args extends unknown[], Result>(
    fn: (...args: Args) => Result
  ): ((...args: Args) => Result) => fn,
}));

vi.mock('next/headers', () => ({
  headers,
}));

vi.mock('next/navigation', () => ({
  redirect,
}));

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: authGetSession,
    },
  },
}));

vi.mock('@/libs/sentry-user-server', () => ({
  syncSentryUserFromSession,
}));

type TestSession = {
  session: {
    impersonatedBy?: string | null;
  };
  user: {
    email?: unknown;
    id: string;
    name?: unknown;
    role?: unknown;
    unconfirmedEmail?: unknown;
  };
};

function createSession(user: TestSession['user']): TestSession {
  return {
    session: { impersonatedBy: null },
    user,
  };
}

beforeEach(() => {
  authGetSession.mockReset();
  headers.mockReset();
  redirect.mockClear();
  syncSentryUserFromSession.mockClear();

  headers.mockResolvedValue(new Headers([['x-auth-test', '1']]));
  authGetSession.mockResolvedValue(null);
});

describe('getSession', () => {
  it('sailor session lookup passes headers and disables cookie cache', async () => {
    const requestHeaders = new Headers([['cookie', 'session=abc']]);
    const session = createSession({ id: 'user-1', role: 'user' });
    headers.mockResolvedValue(requestHeaders);
    authGetSession.mockResolvedValue(session);

    const { getSession } = await import('@/libs/auth/dal');

    await expect(getSession()).resolves.toBe(session);
    expect(authGetSession).toHaveBeenCalledWith({
      headers: requestHeaders,
      query: { disableCookieCache: true },
    });
  });

  it('admin session lookup syncs Sentry identity', async () => {
    const session = createSession({ id: 'user-1', role: 'admin' });
    authGetSession.mockResolvedValue(session);

    const { getSession } = await import('@/libs/auth/dal');

    await getSession();

    expect(syncSentryUserFromSession).toHaveBeenCalledWith(session);
  });
});

describe('redirectIfAuthenticated', () => {
  it('visitor stays on auth pages while signed out', async () => {
    const { redirectIfAuthenticated } = await import('@/libs/auth/dal');

    await expect(
      redirectIfAuthenticated('en', '/profile')
    ).resolves.toBeUndefined();

    expect(redirect).not.toHaveBeenCalled();
  });

  it('sailor returns to a safe callback when already signed in', async () => {
    authGetSession.mockResolvedValue(createSession({ id: 'user-1' }));
    const { redirectIfAuthenticated } = await import('@/libs/auth/dal');

    await expect(
      redirectIfAuthenticated('en', '/profile?tab=appearance')
    ).rejects.toThrow('NEXT_REDIRECT:/profile?tab=appearance');

    expect(redirect).toHaveBeenCalledWith('/profile?tab=appearance');
  });

  it('sailor returns home instead of an unsafe callback', async () => {
    authGetSession.mockResolvedValue(createSession({ id: 'user-1' }));
    const { redirectIfAuthenticated } = await import('@/libs/auth/dal');

    await expect(
      redirectIfAuthenticated('en', 'https://example.com/profile')
    ).rejects.toThrow('NEXT_REDIRECT:/');

    expect(redirect).toHaveBeenCalledWith('/');
  });
});

describe('verifySession', () => {
  it('visitor redirects to sign-in with a preserved callback', async () => {
    const { verifySession } = await import('@/libs/auth/dal');

    await expect(verifySession('en', '/fleet/')).rejects.toThrow(
      'NEXT_REDIRECT:/login?callbackUrl=%2Ffleet%2F'
    );

    expect(redirect).toHaveBeenCalledWith('/login?callbackUrl=%2Ffleet%2F');
  });

  it('sailor continues with a verified session', async () => {
    const session = createSession({ id: 'user-1', role: 'user' });
    authGetSession.mockResolvedValue(session);
    const { verifySession } = await import('@/libs/auth/dal');

    await expect(verifySession('en')).resolves.toBe(session);

    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  it('admin can enter protected admin routes', async () => {
    const session = createSession({ id: 'admin-1', role: 'admin' });
    authGetSession.mockResolvedValue(session);
    const { requireAdmin } = await import('@/libs/auth/dal');

    await expect(requireAdmin('en')).resolves.toBe(session);

    expect(redirect).not.toHaveBeenCalled();
  });

  it('sailor redirects home from admin routes', async () => {
    authGetSession.mockResolvedValue(
      createSession({ id: 'user-1', role: 'user' })
    );
    const { requireAdmin } = await import('@/libs/auth/dal');

    await expect(requireAdmin('en')).rejects.toThrow('NEXT_REDIRECT:/');

    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('impersonating admin redirects home from admin routes', async () => {
    authGetSession.mockResolvedValue({
      ...createSession({ id: 'admin-1', role: 'admin' }),
      session: { impersonatedBy: 'owner-1' },
    });
    const { requireAdmin } = await import('@/libs/auth/dal');

    await expect(requireAdmin('en')).rejects.toThrow('NEXT_REDIRECT:/');

    expect(redirect).toHaveBeenCalledWith('/');
  });
});

describe('getCurrentUser', () => {
  it('visitor has no current user DTO', async () => {
    const { getCurrentUser } = await import('@/libs/auth/dal');

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('sailor gets normalized current user fields', async () => {
    authGetSession.mockResolvedValue(
      createSession({
        email: 'sailor@example.com',
        id: 'user-1',
        name: 'Sailor',
        role: 'captain',
        unconfirmedEmail: 123,
      })
    );
    const { getCurrentUser } = await import('@/libs/auth/dal');

    await expect(getCurrentUser()).resolves.toEqual({
      email: 'sailor@example.com',
      id: 'user-1',
      name: 'Sailor',
      role: 'user',
      unconfirmedEmail: null,
    });
  });
});

describe('requireCurrentUser', () => {
  it('admin gets a required current user DTO', async () => {
    authGetSession.mockResolvedValue(
      createSession({
        email: 'admin@example.com',
        id: 'admin-1',
        name: null,
        role: 'admin',
        unconfirmedEmail: 'new-admin@example.com',
      })
    );
    const { requireCurrentUser } = await import('@/libs/auth/dal');

    await expect(requireCurrentUser('en', '/profile')).resolves.toEqual({
      email: 'admin@example.com',
      id: 'admin-1',
      name: null,
      role: 'admin',
      unconfirmedEmail: 'new-admin@example.com',
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
