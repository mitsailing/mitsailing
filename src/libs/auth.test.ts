import { beforeEach, describe, expect, it, vi } from 'vitest';

type AuthPlugin = {
  config?: unknown;
  id: string;
};

type AuthConfig = {
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

const authMocks = vi.hoisted(() => ({
  Env: {
    BETTER_AUTH_SECRET: 'test-secret',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    NEXT_PUBLIC_IS_E2E: '0',
    NODE_ENV: 'production',
  },
  admin: vi.fn((config: unknown) => ({ config, id: 'admin' })),
  auditLog: vi.fn((config: unknown) => ({ config, id: 'auditLog' })),
  betterAuth: vi.fn((config: unknown) => ({ config, id: 'betterAuth' })),
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
  prismaAdapter: vi.fn((database: unknown, options: unknown) => ({
    database,
    id: 'prismaAdapter',
    options,
  })),
  sendDeleteAccountVerificationEmail: vi.fn(),
  sendEmailChangeRequestedNotice: vi.fn(),
  sendEmailOtpCode: vi.fn(),
  sendPasswordChangedNotice: vi.fn(),
  signInEmailHooks: {
    after: vi.fn(),
    before: vi.fn(),
  },
  verify: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@better-auth/i18n', () => ({
  i18n: authMocks.i18n,
}));

vi.mock('@better-auth/prisma-adapter', () => ({
  prismaAdapter: authMocks.prismaAdapter,
}));

vi.mock('@node-rs/argon2', () => ({
  hash: authMocks.hash,
  verify: authMocks.verify,
}));

vi.mock('better-auth', () => ({
  betterAuth: authMocks.betterAuth,
}));

vi.mock('better-auth-audit-logs', () => ({
  auditLog: authMocks.auditLog,
}));

vi.mock('better-auth/next-js', () => ({
  nextCookies: authMocks.nextCookies,
}));

vi.mock('better-auth/plugins', () => ({
  admin: authMocks.admin,
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
    Array.isArray(value.plugins) &&
    value.plugins.every(isAuthPlugin) &&
    isRecord(value.rateLimit) &&
    typeof value.rateLimit.enabled === 'boolean' &&
    isRecord(value.user) &&
    isRecord(value.user.deleteUser) &&
    typeof value.user.deleteUser.sendDeleteAccountVerification === 'function'
  );
}

function isEmailOtpConfig(value: unknown): value is EmailOtpConfig {
  return isRecord(value) && typeof value.sendVerificationOTP === 'function';
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
  authMocks.Env.NEXT_PUBLIC_IS_E2E = '0';
  authMocks.hash.mockResolvedValue('hashed-password');
  authMocks.verify.mockResolvedValue(true);
  authMocks.markPendingEmailChange.mockResolvedValue(true);
  authMocks.prisma.user.updateMany.mockResolvedValue({ count: 1 });
});

describe('auth', () => {
  it('registers Better Auth server plugins and production rate limits', async () => {
    const { auth, config } = await importAuthConfig();

    expect(auth).toEqual({ config, id: 'betterAuth' });
    expect(authMocks.prismaAdapter).toHaveBeenCalledWith(authMocks.prisma, {
      provider: 'postgresql',
    });
    expect(config.rateLimit.enabled).toBe(true);
    expect(config.plugins.map((plugin) => plugin.id)).toEqual([
      'admin',
      'haveIBeenPwned',
      'emailOTP',
      'auditLog',
      'i18n',
      'nextCookies',
    ]);
  });

  it('disables IP rate limits for e2e runtime', async () => {
    authMocks.Env.NEXT_PUBLIC_IS_E2E = '1';

    const { config } = await importAuthConfig();

    expect(config.rateLimit.enabled).toBe(false);
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
