import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  sailingCardAgreement,
  sailingCardAgreementHash,
} from '@/libs/mit-sailing/sailingCardAgreement';

const {
  authGetSession,
  headers,
  prismaUserFindUnique,
  redirect,
  syncSentryUserFromSession,
} = vi.hoisted(() => ({
  authGetSession: vi.fn(),
  headers: vi.fn(),
  prismaUserFindUnique: vi.fn(),
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

vi.mock('@/libs/DB', () => ({
  prisma: {
    user: {
      findUnique: prismaUserFindUnique,
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
    banned?: unknown;
    email?: unknown;
    emailVerified?: unknown;
    id: string;
    name?: unknown;
    role?: unknown;
    unconfirmedEmail?: unknown;
  };
};

function createSession(user: TestSession['user']): TestSession {
  return {
    session: { impersonatedBy: null },
    user: {
      banned: false,
      emailVerified: true,
      ...user,
    },
  };
}

const currentOnboardingLegalAcceptance = {
  acceptedUserId: 'user-1',
  agreementHash: sailingCardAgreementHash(),
  agreementVersion: sailingCardAgreement.version,
  source: 'SAILING_CARD_ONBOARDING',
  userId: 'user-1',
};

beforeEach(() => {
  authGetSession.mockReset();
  headers.mockReset();
  prismaUserFindUnique.mockReset();
  redirect.mockClear();
  syncSentryUserFromSession.mockClear();

  headers.mockResolvedValue(new Headers([['x-auth-test', '1']]));
  authGetSession.mockResolvedValue(null);
  prismaUserFindUnique.mockResolvedValue({
    emergencyContactName: 'Grace Hopper',
    emergencyContactPhone: '+442079460958',
    legalAgreementAcceptances: [
      {
        acceptedAt: new Date('2026-05-20T12:01:00-04:00'),
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
      },
    ],
    phone: '+16175550100',
    sailingCardRequests: [
      {
        cardYear: 2026,
        legalAgreementAcceptance: currentOnboardingLegalAcceptance,
        status: 'pending',
        userId: 'user-1',
        user: {
          emergencyContactName: 'Grace Hopper',
          emergencyContactPhone: '+442079460958',
          phone: '+16175550100',
        },
      },
    ],
    sailingCardExpiresOn: null,
    sailingCardIssuedAt: null,
    sailingCardNumber: null,
    sailingCardRequestedAt: new Date('2026-05-20T12:00:00-04:00'),
    sailingCardSwimAgreementInitials: 'AK',
    sailingCardYear: null,
  });
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

describe('appRoleFromSessionUser', () => {
  it('normalizes malformed session users to sailor role', async () => {
    const { appRoleFromSessionUser } = await import('@/libs/auth/dal');

    expect(appRoleFromSessionUser(null)).toBe('user');
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
    expect(prismaUserFindUnique).not.toHaveBeenCalled();
  });

  it('fails closed for comma-separated role strings', async () => {
    authGetSession.mockResolvedValue(
      createSession({
        appRole: 'dock_staff,other_role',
        id: 'staff-1',
        role: 'user',
      })
    );
    const { requirePermission } = await import('@/libs/auth/dal');
    const { Permission } = await import('@/libs/auth/permissions');

    await expect(
      requirePermission(Permission.USERS_VIEW, 'en')
    ).rejects.toThrow('NEXT_REDIRECT:/');

    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('redirects impersonating staff from permission routes', async () => {
    authGetSession.mockResolvedValue({
      ...createSession({
        appRole: 'dock_staff',
        id: 'staff-1',
        role: 'user',
      }),
      session: { impersonatedBy: 'owner-1' },
    });
    const { requirePermission } = await import('@/libs/auth/dal');
    const { Permission } = await import('@/libs/auth/permissions');

    await expect(
      requirePermission(Permission.USERS_VIEW, 'en')
    ).rejects.toThrow('NEXT_REDIRECT:/');

    expect(redirect).toHaveBeenCalledWith('/');
  });

  it.each([
    ['banned staff', { appRole: 'dock_staff', banned: true }],
    ['unverified staff', { appRole: 'dock_staff', emailVerified: false }],
    ['malformed ban state', { appRole: 'dock_staff', banned: null }],
    [
      'malformed verification state',
      { appRole: 'dock_staff', emailVerified: null },
    ],
  ])('fails closed for %s', async (_label, overrides) => {
    authGetSession.mockResolvedValue(
      createSession({
        id: 'staff-1',
        role: 'user',
        ...overrides,
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
        email: null,
        appRole: 'dock_staff',
        id: 'user-1',
        name: 123,
        role: 'captain',
        unconfirmedEmail: 123,
      })
    );
    const { getCurrentUser } = await import('@/libs/auth/dal');

    await expect(getCurrentUser()).resolves.toEqual({
      email: null,
      id: 'user-1',
      name: null,
      role: 'dock_staff',
      unconfirmedEmail: null,
    });
  });

  it('preserves string current user profile fields', async () => {
    authGetSession.mockResolvedValue(
      createSession({
        email: 'sailor@example.com',
        appRole: 'user',
        id: 'user-1',
        name: 'Ada Sailor',
        role: 'user',
        unconfirmedEmail: 'new-sailor@example.com',
      })
    );
    const { getCurrentUser } = await import('@/libs/auth/dal');

    await expect(getCurrentUser()).resolves.toEqual({
      email: 'sailor@example.com',
      id: 'user-1',
      name: 'Ada Sailor',
      role: 'user',
      unconfirmedEmail: 'new-sailor@example.com',
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

  it('redirects member-facing flows to onboarding when yearly state is missing', async () => {
    authGetSession.mockResolvedValue(
      createSession({
        email: 'sailor@example.com',
        appRole: 'user',
        id: 'user-1',
        role: 'user',
      })
    );
    prismaUserFindUnique.mockResolvedValue({
      emergencyContactName: null,
      emergencyContactPhone: null,
      phone: null,
      sailingCardRequests: [],
      sailingCardExpiresOn: null,
      sailingCardIssuedAt: null,
      sailingCardNumber: null,
      sailingCardRequestedAt: null,
      sailingCardSwimAgreementInitials: null,
      sailingCardYear: null,
    });
    const { requireCurrentUser } = await import('@/libs/auth/dal');

    await expect(requireCurrentUser('en', '/profile')).rejects.toThrow(
      'NEXT_REDIRECT:/onboarding?callbackUrl=%2Fprofile'
    );

    expect(redirect).toHaveBeenCalledWith('/onboarding?callbackUrl=%2Fprofile');
  });

  it('redirects to sign-in when the session user was deleted', async () => {
    authGetSession.mockResolvedValue(
      createSession({
        email: 'sailor@example.com',
        appRole: 'user',
        id: 'deleted-user',
        role: 'user',
      })
    );
    prismaUserFindUnique.mockResolvedValue(null);
    const { requireCurrentUser } = await import('@/libs/auth/dal');

    await expect(requireCurrentUser('en', '/profile')).rejects.toThrow(
      'NEXT_REDIRECT:/login?callbackUrl=%2Fprofile'
    );

    expect(redirect).toHaveBeenCalledWith('/login?callbackUrl=%2Fprofile');
  });

  it('redirects current-card users to onboarding when contact fields are missing', async () => {
    authGetSession.mockResolvedValue(
      createSession({
        email: 'sailor@example.com',
        appRole: 'user',
        id: 'user-1',
        role: 'user',
      })
    );
    prismaUserFindUnique.mockResolvedValue({
      emergencyContactName: null,
      emergencyContactPhone: '+442079460958',
      phone: '+16175550100',
      sailingCardRequests: [],
      sailingCardExpiresOn: new Date('2027-07-15T04:00:00.000Z'),
      sailingCardIssuedAt: new Date('2026-08-01T16:00:00.000Z'),
      sailingCardNumber: 61,
      sailingCardRequestedAt: null,
      sailingCardSwimAgreementInitials: 'AK',
      sailingCardYear: 2027,
    });
    const { requireCurrentUser } = await import('@/libs/auth/dal');

    await expect(requireCurrentUser('en', '/profile')).rejects.toThrow(
      'NEXT_REDIRECT:/onboarding?callbackUrl=%2Fprofile'
    );
  });

  it('allows member-facing flows with current-year request evidence', async () => {
    authGetSession.mockResolvedValue(
      createSession({
        email: 'sailor@example.com',
        appRole: 'user',
        id: 'user-1',
        role: 'user',
      })
    );
    prismaUserFindUnique.mockResolvedValue({
      sailingCardRequests: [
        {
          cardYear: 2026,
          legalAgreementAcceptance: currentOnboardingLegalAcceptance,
          status: 'pending',
          userId: 'user-1',
          user: {
            emergencyContactName: 'Grace Hopper',
            emergencyContactPhone: '+442079460958',
            phone: '+16175550100',
          },
        },
      ],
    });
    const { requireCurrentUser } = await import('@/libs/auth/dal');

    await expect(requireCurrentUser('en', '/profile')).resolves.toEqual({
      email: 'sailor@example.com',
      id: 'user-1',
      name: null,
      role: 'user',
      unconfirmedEmail: null,
    });
  });

  it('redirects stale prior-year pending requests after the annual cutoff', async () => {
    authGetSession.mockResolvedValue(
      createSession({
        email: 'sailor@example.com',
        appRole: 'user',
        id: 'user-1',
        role: 'user',
      })
    );
    prismaUserFindUnique.mockResolvedValue({
      sailingCardRequests: [
        {
          cardYear: 2026,
          legalAgreementAcceptance: currentOnboardingLegalAcceptance,
          status: 'pending',
          userId: 'user-1',
          user: {
            emergencyContactName: 'Grace Hopper',
            emergencyContactPhone: '+442079460958',
            phone: '+16175550100',
          },
        },
      ],
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T00:01:00-04:00'));
    const { requireCurrentUser } = await import('@/libs/auth/dal');

    await expect(requireCurrentUser('en', '/profile')).rejects.toThrow(
      'NEXT_REDIRECT:/onboarding?callbackUrl=%2Fprofile'
    );
  });

  it('does not redirect the onboarding page to itself', async () => {
    authGetSession.mockResolvedValue(
      createSession({
        email: 'sailor@example.com',
        appRole: 'user',
        id: 'user-1',
        role: 'user',
      })
    );
    const { requireCurrentUser } = await import('@/libs/auth/dal');

    await expect(requireCurrentUser('en', '/onboarding')).resolves.toEqual({
      email: 'sailor@example.com',
      id: 'user-1',
      name: null,
      role: 'user',
      unconfirmedEmail: null,
    });

    expect(prismaUserFindUnique).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
