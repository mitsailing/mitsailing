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

vi.mock('@/utils/AppConfig', () => ({
  AppConfig: {
    i18n: {
      defaultLocale: 'en',
    },
  },
}));

vi.mock('@/utils/Helpers', () => ({
  getI18nPath: (path: string) => path,
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
    appRole?: unknown;
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
  it('pass headers and disable cookie cache for sailor session', async () => {
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

  it('sync sentry identity for admin session', async () => {
    const session = createSession({ id: 'user-1', role: 'admin' });
    authGetSession.mockResolvedValue(session);

    const { getSession } = await import('@/libs/auth/dal');

    await getSession();

    expect(syncSentryUserFromSession).toHaveBeenCalledWith(session);
  });
});

describe('redirectIfAuthenticated', () => {
  it('keep visitor on auth pages when signed out', async () => {
    const { redirectIfAuthenticated } = await import('@/libs/auth/dal');

    await expect(
      redirectIfAuthenticated('en', '/profile')
    ).resolves.toBeUndefined();

    expect(redirect).not.toHaveBeenCalled();
  });

  it('return safe callback for signed-in sailor', async () => {
    authGetSession.mockResolvedValue(createSession({ id: 'user-1' }));
    const { redirectIfAuthenticated } = await import('@/libs/auth/dal');

    await expect(
      redirectIfAuthenticated('en', '/profile?tab=appearance')
    ).rejects.toThrow('NEXT_REDIRECT:/profile?tab=appearance');

    expect(redirect).toHaveBeenCalledWith('/profile?tab=appearance');
  });

  it('redirect to home for unsafe callback', async () => {
    authGetSession.mockResolvedValue(createSession({ id: 'user-1' }));
    const { redirectIfAuthenticated } = await import('@/libs/auth/dal');

    await expect(
      redirectIfAuthenticated('en', 'https://example.com/profile')
    ).rejects.toThrow('NEXT_REDIRECT:/');

    expect(redirect).toHaveBeenCalledWith('/');
  });
});

describe('verifySession', () => {
  it('redirect visitor to sign-in with preserved callback', async () => {
    const { verifySession } = await import('@/libs/auth/dal');

    await expect(verifySession('en', '/fleet')).rejects.toThrow(
      'NEXT_REDIRECT:/login?callbackUrl=%2Ffleet'
    );

    expect(redirect).toHaveBeenCalledWith('/login?callbackUrl=%2Ffleet');
  });

  it('continue with verified sailor session', async () => {
    const session = createSession({ id: 'user-1', role: 'user' });
    authGetSession.mockResolvedValue(session);
    const { verifySession } = await import('@/libs/auth/dal');

    await expect(verifySession('en')).resolves.toBe(session);

    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  it('allow admin into protected admin routes', async () => {
    const session = createSession({
      appRole: 'admin',
      id: 'admin-1',
      role: 'user',
    });
    authGetSession.mockResolvedValue(session);
    const { requireAdmin } = await import('@/libs/auth/dal');

    await expect(requireAdmin('en')).resolves.toBe(session);

    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirect sailor from admin routes to home', async () => {
    authGetSession.mockResolvedValue(
      createSession({ appRole: 'user', id: 'user-1', role: 'admin' })
    );
    const { requireAdmin } = await import('@/libs/auth/dal');

    await expect(requireAdmin('en')).rejects.toThrow('NEXT_REDIRECT:/');
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('redirect impersonating admin from admin routes', async () => {
    authGetSession.mockResolvedValue({
      ...createSession({ appRole: 'admin', id: 'admin-1', role: 'admin' }),
      session: { impersonatedBy: 'owner-1' },
    });
    const { requireAdmin } = await import('@/libs/auth/dal');

    await expect(requireAdmin('en')).rejects.toThrow('NEXT_REDIRECT:/');

    expect(redirect).toHaveBeenCalledWith('/');
  });
});

describe('requirePermission', () => {
  it('allow staff with app role permission', async () => {
    const session = createSession({
      appRole: 'dock_staff',
      id: 'staff-1',
      role: 'user',
    });
    authGetSession.mockResolvedValue(session);
    const { requirePermission } = await import('@/libs/auth/dal');
    const { Permission } = await import('@/libs/auth/permissions');

    await expect(requirePermission(Permission.USERS_VIEW, 'en')).resolves.toBe(
      session
    );

    expect(redirect).not.toHaveBeenCalled();
  });

  it('fails closed for comma-separated role strings', async () => {
    authGetSession.mockResolvedValue(
      createSession({
        appRole: 'user',
        id: 'staff-1',
        role: 'dock_staff',
      })
    );
    const { requirePermission } = await import('@/libs/auth/dal');
    const { Permission } = await import('@/libs/auth/permissions');

    await expect(
      requirePermission(Permission.USERS_VIEW, 'en')
    ).rejects.toThrow('NEXT_REDIRECT:/');

    expect(redirect).toHaveBeenCalledWith('/');
  });
});

describe('getCurrentUser', () => {
  it('return null current user for visitor', async () => {
    const { getCurrentUser } = await import('@/libs/auth/dal');

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('normalize current user fields for sailor', async () => {
    authGetSession.mockResolvedValue(
      createSession({
        email: 'sailor@example.com',
        appRole: 'dock_staff',
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
      role: 'dock_staff',
      unconfirmedEmail: null,
    });
  });
});

describe('requireCurrentUser', () => {
  it('redirect visitor to sign-in for required current user', async () => {
    const { requireCurrentUser } = await import('@/libs/auth/dal');

    await expect(requireCurrentUser('en', '/profile')).rejects.toThrow(
      'NEXT_REDIRECT:/login?callbackUrl=%2Fprofile'
    );
    expect(redirect).toHaveBeenCalledWith('/login?callbackUrl=%2Fprofile');
  });

  it('return required current user DTO for admin', async () => {
    authGetSession.mockResolvedValue(
      createSession({
        email: 'admin@example.com',
        appRole: 'admin',
        id: 'admin-1',
        name: null,
        role: 'user',
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
