import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role, ROLE_VALUES } from '@/libs/auth/roles';
import type * as AuthContextModule from '@/libs/zenstack/authContext';

type AuthPlugin = {
  config?: unknown;
  hooks?: {
    before?: {
      handler: (context: unknown) => Promise<unknown>;
      matcher: (context: { path: string }) => boolean;
    }[];
  };
  id: string;
};

type AuthConfig = {
  database: unknown;
  emailAndPassword: {
    onPasswordReset: (props: { user: { email: string } }) => Promise<void>;
    password: {
      hash: (password: string) => Promise<string>;
      verify: (props: { hash: string; password: string }) => Promise<boolean>;
    };
  };
  emailVerification: {
    afterEmailVerification: (user: { id: string }) => Promise<void>;
  };
  plugins: AuthPlugin[];
  rateLimit: {
    enabled: boolean;
  };
  user: {
    additionalFields: Record<
      string,
      {
        defaultValue?: unknown;
        fieldName?: string;
        input?: boolean;
        required?: boolean;
        type?: unknown;
      }
    >;
    deleteUser: {
      sendDeleteAccountVerification: (props: {
        url: string;
        user: { email: string };
      }) => Promise<void>;
    };
  };
};

type EmailOtpConfig = {
  sendVerificationOTP: (
    props: { email: string; otp: string; type: string },
    ctx?: {
      context: {
        session?: {
          user?: {
            email?: string;
            id?: string;
          };
        };
      };
    }
  ) => Promise<void>;
};

type AuthRoleConfig = {
  authorize: (permissions: { user: string[] }) => { success: boolean };
};

type TestBetterAuthAdapter = {
  findOne: (input: unknown) => Promise<unknown>;
};

type TestBetterAuthAdapterFactory = (options: unknown) => TestBetterAuthAdapter;

const authMocks = vi.hoisted(() => ({
  Env: {
    BETTER_AUTH_SECRET: 'test-secret',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    IS_E2E: undefined as '1' | undefined,
    NODE_ENV: 'production',
  },
  admin: vi.fn((config: unknown) => ({ config, id: 'admin' })),
  auditLog: vi.fn((config: unknown) => ({ config, id: 'auditLog' })),
  betterAuth: vi.fn((config: unknown) => ({ config, id: 'betterAuth' })),
  createAuthMiddleware: vi.fn((handler: unknown) => handler),
  customSession: vi.fn((config: unknown) => ({
    config,
    id: 'custom-session',
  })),
  emailOTP: vi.fn((config: unknown) => ({ config, id: 'emailOTP' })),
  hash: vi.fn(),
  haveIBeenPwned: vi.fn((config: unknown) => ({
    config,
    id: 'haveIBeenPwned',
  })),
  i18n: vi.fn((config: unknown) => ({ config, id: 'i18n' })),
  loggerError: vi.fn(),
  markPendingEmailChange: vi.fn(),
  nextCookies: vi.fn(() => ({ id: 'nextCookies' })),
  passwordCompromiseCheckEnabled: true,
  prisma: {
    user: {
      updateMany: vi.fn(),
    },
  },
  sendDeleteAccountVerificationEmail: vi.fn(),
  sendEmailChangeRequestedNotice: vi.fn(),
  sendEmailOtpCode: vi.fn(),
  sendPasswordChangedNotice: vi.fn(),
  signInEmailHooks: {
    after: vi.fn(),
    before: vi.fn(),
  },
  appSessionDataForBetterAuth: vi.fn(),
  betterAuthZenStackAdapter: { id: 'zenstackAdapter' },
  getBetterAuthZenStackAdapter: vi.fn(),
  verify: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@better-auth/i18n', () => ({
  i18n: authMocks.i18n,
}));

vi.mock('@node-rs/argon2', () => ({
  hash: authMocks.hash,
  verify: authMocks.verify,
}));

vi.mock('better-auth', () => ({
  betterAuth: authMocks.betterAuth,
}));

vi.mock('better-auth/api', () => ({
  createAuthMiddleware: authMocks.createAuthMiddleware,
}));

vi.mock('better-auth-audit-logs', () => ({
  auditLog: authMocks.auditLog,
}));

vi.mock('better-auth/next-js', () => ({
  nextCookies: authMocks.nextCookies,
}));

vi.mock('better-auth/plugins', () => ({
  admin: authMocks.admin,
  customSession: authMocks.customSession,
  emailOTP: authMocks.emailOTP,
  haveIBeenPwned: authMocks.haveIBeenPwned,
}));

vi.mock('@/libs/auth/hooks', () => ({
  signInEmailHooks: authMocks.signInEmailHooks,
}));

vi.mock('@/libs/auth/password-compromise', () => ({
  passwordCompromiseCheckEnabled: authMocks.passwordCompromiseCheckEnabled,
}));

vi.mock('@/libs/DB', () => ({
  prisma: authMocks.prisma,
}));

vi.mock('@/libs/email/account-emails', () => ({
  markPendingEmailChange: authMocks.markPendingEmailChange,
  sendDeleteAccountVerificationEmail:
    authMocks.sendDeleteAccountVerificationEmail,
  sendEmailChangeRequestedNotice: authMocks.sendEmailChangeRequestedNotice,
  sendEmailOtpCode: authMocks.sendEmailOtpCode,
  sendPasswordChangedNotice: authMocks.sendPasswordChangedNotice,
}));

vi.mock('@/libs/Env', () => ({
  Env: authMocks.Env,
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: authMocks.loggerError,
  },
}));

vi.mock('@/libs/zenstack/auth', () => ({
  getBetterAuthZenStackAdapter: authMocks.getBetterAuthZenStackAdapter,
}));

vi.mock('@/libs/zenstack/authContext', async (importOriginal) => {
  const actual = await importOriginal<typeof AuthContextModule>();
  return {
    ...actual,
    appSessionDataForBetterAuth: authMocks.appSessionDataForBetterAuth,
  };
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAuthPlugin(value: unknown): value is AuthPlugin {
  return isRecord(value) && typeof value.id === 'string';
}

function isAuthConfig(value: unknown): value is AuthConfig {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isRecord(value.emailAndPassword) &&
    isRecord(value.emailAndPassword.password) &&
    typeof value.emailAndPassword.onPasswordReset === 'function' &&
    typeof value.emailAndPassword.password.hash === 'function' &&
    typeof value.emailAndPassword.password.verify === 'function' &&
    isRecord(value.emailVerification) &&
    typeof value.emailVerification.afterEmailVerification === 'function' &&
    'database' in value &&
    Array.isArray(value.plugins) &&
    value.plugins.every(isAuthPlugin) &&
    isRecord(value.rateLimit) &&
    typeof value.rateLimit.enabled === 'boolean' &&
    isRecord(value.user) &&
    isRecord(value.user.additionalFields) &&
    isRecord(value.user.deleteUser) &&
    typeof value.user.deleteUser.sendDeleteAccountVerification === 'function'
  );
}

function isEmailOtpConfig(value: unknown): value is EmailOtpConfig {
  return isRecord(value) && typeof value.sendVerificationOTP === 'function';
}

function isAuthRoleConfig(value: unknown): value is AuthRoleConfig {
  return isRecord(value) && typeof value.authorize === 'function';
}

function isTestBetterAuthAdapterFactory(
  value: unknown
): value is TestBetterAuthAdapterFactory {
  return typeof value === 'function';
}

function authPluginById(config: AuthConfig, id: string): AuthPlugin {
  const plugin = config.plugins.find((candidate) => candidate.id === id);

  if (!plugin) {
    throw new Error(`${id} plugin was not registered`);
  }

  return plugin;
}

function latestAuthConfig(): AuthConfig {
  const call = authMocks.betterAuth.mock.calls.at(-1);

  if (!call) {
    throw new Error('betterAuth was not called');
  }

  const [config] = call;
  if (!isAuthConfig(config)) {
    throw new TypeError('betterAuth config did not match the expected shape');
  }

  return config;
}

function emailOtpConfig(config: AuthConfig): EmailOtpConfig {
  const plugin = config.plugins.find(
    (candidate) => candidate.id === 'emailOTP'
  );

  if (!plugin) {
    throw new Error('emailOTP plugin was not registered');
  }

  if (!isEmailOtpConfig(plugin.config)) {
    throw new TypeError('emailOTP config did not match the expected shape');
  }

  return plugin.config;
}

async function importAuthConfig() {
  const { auth } = await import('@/libs/auth');
  return { auth, config: latestAuthConfig() };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  authMocks.Env.NODE_ENV = 'production';
  authMocks.Env.IS_E2E = undefined;
  authMocks.createAuthMiddleware.mockImplementation(
    (handler: unknown) => handler
  );
  authMocks.hash.mockResolvedValue('hashed-password');
  authMocks.verify.mockResolvedValue(true);
  authMocks.markPendingEmailChange.mockResolvedValue(true);
  authMocks.prisma.user.updateMany.mockResolvedValue({ count: 1 });
  authMocks.sendDeleteAccountVerificationEmail.mockImplementation(
    async () => {}
  );
  authMocks.sendEmailChangeRequestedNotice.mockImplementation(async () => {});
  authMocks.sendEmailOtpCode.mockImplementation(async () => {});
  authMocks.sendPasswordChangedNotice.mockImplementation(async () => {});
  authMocks.getBetterAuthZenStackAdapter.mockReturnValue(
    authMocks.betterAuthZenStackAdapter
  );
  authMocks.appSessionDataForBetterAuth.mockImplementation(
    (session: unknown) => ({
      ...(isRecord(session) ? session : {}),
      user: {
        appRole: Role.ADMIN,
        banned: false,
        emailVerified: true,
        role: Role.ADMIN,
      },
    })
  );
});

describe('auth', () => {
  it('registers Better Auth server plugins and production rate limits', async () => {
    const { auth, config } = await importAuthConfig();

    expect(auth).toEqual({ config, id: 'betterAuth' });
    expect(config.database).not.toBe(authMocks.betterAuthZenStackAdapter);
    expect(isTestBetterAuthAdapterFactory(config.database)).toBe(true);
    expect(config.rateLimit.enabled).toBe(true);
    expect(config.plugins.map((plugin) => plugin.id)).toEqual([
      'app-role-admin-authorization',
      'custom-session',
      'admin',
      'haveIBeenPwned',
      'emailOTP',
      'auditLog',
      'i18n',
      'nextCookies',
    ]);
  });

  it('uses app auth session data for Better Auth sessions', async () => {
    await importAuthConfig();

    expect(authMocks.customSession).toHaveBeenCalledOnce();
    const call: readonly unknown[] | undefined =
      authMocks.customSession.mock.calls.at(-1);
    if (!call) {
      throw new Error('customSession was not called');
    }
    const [sessionMapper] = call;
    if (typeof sessionMapper !== 'function') {
      throw new TypeError('customSession mapper did not match expected shape');
    }
    const session = { session: {}, user: { id: 'admin-1' } };

    await expect(sessionMapper(session)).resolves.toEqual(
      expect.objectContaining({
        user: expect.objectContaining({ role: Role.ADMIN }),
      })
    );
    expect(authMocks.appSessionDataForBetterAuth).toHaveBeenCalledWith(session);
  });

  it('limits Better Auth admin plugin permissions to admin app role mirror', async () => {
    const { config } = await importAuthConfig();
    const adminPlugin = config.plugins.find((plugin) => plugin.id === 'admin');

    if (!isRecord(adminPlugin?.config)) {
      throw new TypeError('admin plugin config did not match expected shape');
    }
    const { roles } = adminPlugin.config;
    if (!isRecord(roles)) {
      throw new TypeError('admin roles did not match expected shape');
    }
    const adminRole = roles[Role.ADMIN];
    const staffRole = roles[Role.DOCK_STAFF];
    if (!isAuthRoleConfig(adminRole) || !isAuthRoleConfig(staffRole)) {
      throw new TypeError(
        'admin role definitions did not match expected shape'
      );
    }

    expect(adminRole.authorize({ user: ['list'] }).success).toBe(true);
    expect(staffRole.authorize({ user: ['list'] }).success).toBe(false);
  });

  it('fails closed for Better Auth admin authorization when role mirror drifts', async () => {
    const staleAdminSession = {
      createdAt: new Date('2026-01-01T00:00:00Z'),
      expiresAt: new Date('2026-01-01T00:30:00Z'),
      id: 'session-1',
      impersonatedBy: null,
      token: 'session-token',
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      user: {
        appRole: Role.USER,
        banned: false,
        emailVerified: true,
        id: 'user-1',
        role: Role.ADMIN,
      },
      userId: 'user-1',
    };
    const findOne = vi.fn(async () => {
      await Promise.resolve();
      return staleAdminSession;
    });
    authMocks.getBetterAuthZenStackAdapter.mockReturnValue(() => ({ findOne }));
    const { config } = await importAuthConfig();

    const authorizationPlugin = authPluginById(
      config,
      'app-role-admin-authorization'
    );
    const hook = authorizationPlugin.hooks?.before?.at(0);
    if (!hook) {
      throw new Error('admin authorization hook was not registered');
    }

    expect(hook.matcher({ path: '/admin/set-role' })).toBe(true);
    await expect(
      hook.handler({ path: '/admin/set-role', query: { page: '1' } })
    ).resolves.toEqual({
      context: {
        query: {
          disableCookieCache: true,
          page: '1',
        },
      },
    });
    expect(
      config.plugins.findIndex((plugin) => plugin.id === authorizationPlugin.id)
    ).toBeLessThan(config.plugins.findIndex((plugin) => plugin.id === 'admin'));

    if (!isTestBetterAuthAdapterFactory(config.database)) {
      throw new TypeError('Better Auth database adapter was not callable');
    }
    const adapter = config.database({});
    const result = await adapter.findOne({
      join: { user: true },
      model: 'session',
      where: [],
    });

    if (!(isRecord(result) && isRecord(result.user))) {
      throw new TypeError('adapter result did not include a joined user');
    }
    expect(result.user.role).toBe(Role.USER);
    const betterAuthRole = result.user.role;
    if (typeof betterAuthRole !== 'string') {
      throw new TypeError('adapter user role did not match expected shape');
    }

    const adminPlugin = authPluginById(config, 'admin');
    if (!isRecord(adminPlugin.config) || !isRecord(adminPlugin.config.roles)) {
      throw new TypeError('admin plugin roles did not match expected shape');
    }
    const mirroredRole = adminPlugin.config.roles[betterAuthRole];
    if (!isAuthRoleConfig(mirroredRole)) {
      throw new TypeError('mirrored admin role did not match expected shape');
    }
    expect(mirroredRole.authorize({ user: ['set-role'] }).success).toBe(false);
  });

  it('disables IP rate limits for e2e runtime', async () => {
    authMocks.Env.IS_E2E = '1';

    const { config } = await importAuthConfig();

    expect(config.rateLimit.enabled).toBe(false);
  });

  it('exposes app role as a server-managed session user field', async () => {
    const { config } = await importAuthConfig();

    expect(config.user.additionalFields.appRole).toEqual({
      defaultValue: Role.USER,
      input: false,
      required: false,
      type: ROLE_VALUES,
    });
  });

  it('delegates password hashing and password reset email', async () => {
    const { config } = await importAuthConfig();

    await expect(
      config.emailAndPassword.password.hash('secret-password')
    ).resolves.toBe('hashed-password');
    await expect(
      config.emailAndPassword.password.verify({
        hash: 'hashed-password',
        password: 'secret-password',
      })
    ).resolves.toBe(true);
    await config.emailAndPassword.onPasswordReset({
      user: { email: 'sailor@example.com' },
    });

    expect(authMocks.hash).toHaveBeenCalledWith('secret-password', {
      algorithm: 2,
      memoryCost: 65_536,
      outputLen: 32,
      parallelism: 4,
      timeCost: 3,
    });
    expect(authMocks.verify).toHaveBeenCalledWith(
      'hashed-password',
      'secret-password',
      {
        algorithm: 2,
        memoryCost: 65_536,
        outputLen: 32,
        parallelism: 4,
        timeCost: 3,
      }
    );
    expect(authMocks.sendPasswordChangedNotice).toHaveBeenCalledWith(
      'sailor@example.com'
    );
  });

  it('clears pending email after verification', async () => {
    const { config } = await importAuthConfig();

    await config.emailVerification.afterEmailVerification({ id: 'user-1' });

    expect(authMocks.prisma.user.updateMany).toHaveBeenCalledWith({
      data: { unconfirmedEmail: null },
      where: { id: 'user-1', unconfirmedEmail: { not: null } },
    });
  });

  it('sends delete-account verification email', async () => {
    const { config } = await importAuthConfig();

    await config.user.deleteUser.sendDeleteAccountVerification({
      url: 'https://example.test/delete',
      user: { email: 'sailor@example.com' },
    });

    expect(authMocks.sendDeleteAccountVerificationEmail).toHaveBeenCalledWith(
      'sailor@example.com',
      'https://example.test/delete'
    );
  });

  it('sends OTP code without pending email change for sign-in', async () => {
    const { config } = await importAuthConfig();

    await emailOtpConfig(config).sendVerificationOTP({
      email: 'sailor@example.com',
      otp: '123456',
      type: 'sign-in',
    });

    expect(authMocks.sendEmailOtpCode).toHaveBeenCalledWith({
      email: 'sailor@example.com',
      otp: '123456',
      type: 'sign-in',
    });
    expect(authMocks.markPendingEmailChange).not.toHaveBeenCalled();
  });

  it('records pending email changes and sends current-address notice', async () => {
    const { config } = await importAuthConfig();

    await emailOtpConfig(config).sendVerificationOTP(
      {
        email: 'next@example.com',
        otp: '123456',
        type: 'change-email',
      },
      {
        context: {
          session: {
            user: {
              email: 'sailor@example.com',
              id: 'user-1',
            },
          },
        },
      }
    );

    expect(authMocks.sendEmailOtpCode).toHaveBeenCalledWith({
      email: 'next@example.com',
      otp: '123456',
      type: 'change-email',
    });
    expect(authMocks.markPendingEmailChange).toHaveBeenCalledWith({
      newEmail: 'next@example.com',
      userId: 'user-1',
    });
    expect(authMocks.sendEmailChangeRequestedNotice).toHaveBeenCalledWith({
      currentEmail: 'sailor@example.com',
      newEmail: 'next@example.com',
    });
  });

  it('skips current-address notice when pending email is unchanged', async () => {
    authMocks.markPendingEmailChange.mockResolvedValue(false);
    const { config } = await importAuthConfig();

    await emailOtpConfig(config).sendVerificationOTP(
      {
        email: 'next@example.com',
        otp: '123456',
        type: 'change-email',
      },
      {
        context: {
          session: {
            user: {
              email: 'sailor@example.com',
              id: 'user-1',
            },
          },
        },
      }
    );

    expect(authMocks.sendEmailOtpCode).toHaveBeenCalledWith({
      email: 'next@example.com',
      otp: '123456',
      type: 'change-email',
    });
    expect(authMocks.sendEmailChangeRequestedNotice).not.toHaveBeenCalled();
  });

  it('skips pending email changes without a session user id', async () => {
    const { config } = await importAuthConfig();

    await emailOtpConfig(config).sendVerificationOTP(
      {
        email: 'next@example.com',
        otp: '123456',
        type: 'change-email',
      },
      {
        context: {
          session: {
            user: {
              email: 'sailor@example.com',
            },
          },
        },
      }
    );

    expect(authMocks.sendEmailOtpCode).toHaveBeenCalledWith({
      email: 'next@example.com',
      otp: '123456',
      type: 'change-email',
    });
    expect(authMocks.markPendingEmailChange).not.toHaveBeenCalled();
    expect(authMocks.sendEmailChangeRequestedNotice).not.toHaveBeenCalled();
  });

  it('skips current-address notice when the session email already matches', async () => {
    const { config } = await importAuthConfig();

    await emailOtpConfig(config).sendVerificationOTP(
      {
        email: 'sailor@example.com',
        otp: '123456',
        type: 'change-email',
      },
      {
        context: {
          session: {
            user: {
              email: 'sailor@example.com',
              id: 'user-1',
            },
          },
        },
      }
    );

    expect(authMocks.sendEmailOtpCode).toHaveBeenCalledWith({
      email: 'sailor@example.com',
      otp: '123456',
      type: 'change-email',
    });
    expect(authMocks.markPendingEmailChange).toHaveBeenCalledWith({
      newEmail: 'sailor@example.com',
      userId: 'user-1',
    });
    expect(authMocks.sendEmailChangeRequestedNotice).not.toHaveBeenCalled();
  });

  it('logs current-address notice failures', async () => {
    authMocks.sendEmailChangeRequestedNotice.mockRejectedValue(
      new Error('mail down')
    );
    const { config } = await importAuthConfig();

    await emailOtpConfig(config).sendVerificationOTP(
      {
        email: 'next@example.com',
        otp: '123456',
        type: 'change-email',
      },
      {
        context: {
          session: {
            user: {
              email: 'sailor@example.com',
              id: 'user-1',
            },
          },
        },
      }
    );

    expect(authMocks.sendEmailOtpCode).toHaveBeenCalledWith({
      email: 'next@example.com',
      otp: '123456',
      type: 'change-email',
    });
    expect(authMocks.loggerError).toHaveBeenCalledWith(
      'Failed to send email change requested notice: {error}',
      expect.objectContaining({
        currentEmail: 'sailor@example.com',
        error: expect.any(Error),
        newEmail: 'next@example.com',
        operation: 'sendEmailChangeRequestedNotice',
        userId: 'user-1',
      })
    );
  });

  it('logs non-error current-address notice failures', async () => {
    authMocks.sendEmailChangeRequestedNotice.mockRejectedValue('mail down');
    const { config } = await importAuthConfig();

    await emailOtpConfig(config).sendVerificationOTP(
      {
        email: 'next@example.com',
        otp: '123456',
        type: 'change-email',
      },
      {
        context: {
          session: {
            user: {
              email: 'sailor@example.com',
              id: 'user-1',
            },
          },
        },
      }
    );

    expect(authMocks.sendEmailOtpCode).toHaveBeenCalledWith({
      email: 'next@example.com',
      otp: '123456',
      type: 'change-email',
    });
    expect(authMocks.loggerError).toHaveBeenCalledWith(
      'Failed to send email change requested notice: {error}',
      expect.objectContaining({
        currentEmail: 'sailor@example.com',
        error: 'mail down',
        newEmail: 'next@example.com',
        operation: 'sendEmailChangeRequestedNotice',
        userId: 'user-1',
      })
    );
  });

  it('logs pending email change failures', async () => {
    authMocks.markPendingEmailChange.mockRejectedValue(new Error('db'));
    const { config } = await importAuthConfig();

    await emailOtpConfig(config).sendVerificationOTP(
      {
        email: 'next@example.com',
        otp: '123456',
        type: 'change-email',
      },
      {
        context: {
          session: {
            user: {
              email: 'sailor@example.com',
              id: 'user-1',
            },
          },
        },
      }
    );

    expect(authMocks.sendEmailOtpCode).toHaveBeenCalledWith({
      email: 'next@example.com',
      otp: '123456',
      type: 'change-email',
    });
    expect(authMocks.loggerError).toHaveBeenCalledWith(
      'Failed to mark pending email change: {error}',
      expect.objectContaining({
        currentEmail: 'sailor@example.com',
        error: expect.any(Error),
        newEmail: 'next@example.com',
        operation: 'markPendingEmailChange',
        userId: 'user-1',
      })
    );
    expect(authMocks.sendEmailChangeRequestedNotice).not.toHaveBeenCalled();
  });
});
