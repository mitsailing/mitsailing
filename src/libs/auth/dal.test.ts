import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authGetSession,
  headers,
  listRolePermissionGrants,
  redirect,
  syncSentryUserFromSession,
} = vi.hoisted(() => ({
  authGetSession: vi.fn(),
  headers: vi.fn(),
  listRolePermissionGrants: vi.fn(),
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

vi.mock('@/libs/auth/rolePermissionGrants', () => ({
  listRolePermissionGrants,
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
  listRolePermissionGrants.mockReset();
  redirect.mockClear();
  syncSentryUserFromSession.mockClear();

  headers.mockResolvedValue(new Headers([['x-auth-test', '1']]));
  authGetSession.mockResolvedValue(null);
  listRolePermissionGrants.mockResolvedValue([]);
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
    const session = createSession({ id: 'admin-1', role: 'admin' });
    authGetSession.mockResolvedValue(session);
    const { requireAdmin } = await import('@/libs/auth/dal');

    await expect(requireAdmin('en')).resolves.toBe(session);

    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirect sailor from admin routes to home', async () => {
    authGetSession.mockResolvedValue(
      createSession({ id: 'user-1', role: 'user' })
    );
    const { requireAdmin } = await import('@/libs/auth/dal');

    await expect(requireAdmin('en')).rejects.toThrow('NEXT_REDIRECT:/');

    expect(redirect).toHaveBeenCalledWith('/');
    expect(listRolePermissionGrants).toHaveBeenCalledOnce();
  });

  it('redirect impersonating admin from admin routes', async () => {
    authGetSession.mockResolvedValue({
      ...createSession({ id: 'admin-1', role: 'admin' }),
      session: { impersonatedBy: 'owner-1' },
    });
    const { requireAdmin } = await import('@/libs/auth/dal');

    await expect(requireAdmin('en')).rejects.toThrow('NEXT_REDIRECT:/');

    expect(redirect).toHaveBeenCalledWith('/');
  });
});

describe('requirePermission', () => {
  it('allow staff with granted permission', async () => {
    const session = createSession({
      id: 'staff-1',
      role: 'volunteer_instructor',
    });
    authGetSession.mockResolvedValue(session);
    listRolePermissionGrants.mockResolvedValue([
      { roleKey: 'volunteer_instructor', permissionKey: 'cms.edit' },
    ]);
    const { requirePermission } = await import('@/libs/auth/dal');
    const { Permission } = await import('@/libs/auth/permissions');

    await expect(requirePermission(Permission.CMS_EDIT, 'en')).resolves.toBe(
      session
    );

    expect(redirect).not.toHaveBeenCalled();
  });

  it('allows comma-separated role strings with any granted role', async () => {
    authGetSession.mockResolvedValue(
      createSession({
        id: 'staff-1',
        role: 'volunteer,dock_staff',
      })
    );
    listRolePermissionGrants.mockResolvedValue([
      { roleKey: 'dock_staff', permissionKey: 'cms.edit' },
    ]);
    const { requirePermission } = await import('@/libs/auth/dal');
    const { Permission } = await import('@/libs/auth/permissions');

    await expect(requirePermission(Permission.CMS_EDIT, 'en')).resolves.toEqual(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'staff-1' }),
      })
    );

    expect(redirect).not.toHaveBeenCalled();
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
