import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signInEmailHooks } from '@/libs/auth/hooks';
import { assertPasswordNotCompromised } from '@/libs/auth/password-compromise';
import {
  sendAccountLockedEmail,
  sendPasswordChangedNotice,
} from '@/libs/email/account-emails';

const {
  count,
  create,
  deleteMany,
  findUnique,
  sendAccountLockedEmailMock,
  sendPasswordChangedNoticeMock,
  assertPasswordNotCompromisedMock,
  warn,
} = vi.hoisted(() => ({
  count: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
  findUnique: vi.fn(),
  sendAccountLockedEmailMock: vi.fn(),
  sendPasswordChangedNoticeMock: vi.fn(),
  assertPasswordNotCompromisedMock: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('better-auth/api', () => {
  class APIError extends Error {
    readonly body?: { code?: string; message?: string };
    readonly status: string;

    constructor(status: string, body?: { code?: string; message?: string }) {
      super(body?.message ?? status);
      this.name = 'APIError';
      this.status = status;
      this.body = body;
    }

    static from(status: string, body?: { code?: string; message?: string }) {
      return new APIError(status, body);
    }
  }

  return {
    APIError,
    createAuthMiddleware: (handler: AuthHook) => handler,
  };
});
vi.mock('@/libs/DB', () => ({
  prisma: {
    failedLoginAttempt: { count, create, deleteMany },
    user: { findUnique },
  },
}));
vi.mock('@/libs/auth/password-compromise', () => ({
  assertPasswordNotCompromised: assertPasswordNotCompromisedMock,
}));
vi.mock('@/libs/email/account-emails', () => ({
  sendAccountLockedEmail: sendAccountLockedEmailMock,
  sendPasswordChangedNotice: sendPasswordChangedNoticeMock,
}));

type AuthHook = (ctx: TestAuthContext) => Promise<void>;
type UnknownFunction = (...args: unknown[]) => unknown;

type TestAuthContext = {
  body?: {
    email?: unknown;
    password?: unknown;
  };
  context: {
    newSession?: unknown;
    session?: {
      user?: {
        email?: string | null;
      } | null;
    } | null;
  };
  path: string;
  request?: Request;
};

function isUnknownFunction(value: unknown): value is UnknownFunction {
  return typeof value === 'function';
}

function toAuthHook(value: unknown): AuthHook {
  if (!isUnknownFunction(value)) {
    throw new TypeError('Expected auth hook middleware');
  }

  return async (ctx) => {
    await value(ctx);
  };
}

const hooks = {
  after: toAuthHook(signInEmailHooks.after),
  before: toAuthHook(signInEmailHooks.before),
};

const lockedError = {
  body: { message: 'ACCOUNT_LOCKED' },
  status: 'FORBIDDEN',
};

const emailExistsError = {
  body: { message: 'EMAIL_EXISTS' },
  status: 'CONFLICT',
};

const passwordTooShortError = {
  body: { code: 'PASSWORD_TOO_SHORT', message: 'PASSWORD_TOO_SHORT' },
  status: 'BAD_REQUEST',
};

const passwordTooLongError = {
  body: { code: 'PASSWORD_TOO_LONG', message: 'PASSWORD_TOO_LONG' },
  status: 'BAD_REQUEST',
};

const passwordRequiredError = {
  body: { code: 'PASSWORD_REQUIRED', message: 'PASSWORD_REQUIRED' },
  status: 'BAD_REQUEST',
};

function authContext(props: {
  body?: TestAuthContext['body'];
  context?: TestAuthContext['context'];
  path: string;
  request?: Request;
}): TestAuthContext {
  return {
    context: props.context ?? {},
    path: props.path,
    ...(props.body === undefined ? {} : { body: props.body }),
    ...(props.request === undefined ? {} : { request: props.request }),
  };
}

function requestWithCfIp(ip: string): Request {
  return new Request('https://example.test/sign-in/email', {
    headers: { 'cf-connecting-ip': ip },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-08T16:30:00.000Z'));
  vi.clearAllMocks();
  count.mockResolvedValue(0);
  create.mockResolvedValue({});
  deleteMany.mockResolvedValue({ count: 0 });
  findUnique.mockResolvedValue(null);
  sendAccountLockedEmailMock.mockImplementation(async () => {});
  sendPasswordChangedNoticeMock.mockImplementation(async () => {});
  assertPasswordNotCompromisedMock.mockImplementation(async () => {});
  vi.spyOn(console, 'warn').mockImplementation(warn);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('signInEmailHooks before', () => {
  it('locked-out sailor cannot pass sign-in preflight during active lockout', async () => {
    count.mockResolvedValue(5);

    await expect(
      hooks.before(
        authContext({
          body: { email: ' Locked.User@Example.COM ' },
          path: '/sign-in/email',
        })
      )
    ).rejects.toMatchObject(lockedError);

    expect(count).toHaveBeenCalledWith({
      where: {
        createdAt: { gt: new Date('2026-05-08T16:15:00.000Z') },
        email: 'locked.user@example.com',
      },
    });
  });

  it('sailor can pass sign-in preflight below the lockout threshold', async () => {
    count.mockResolvedValue(4);

    await expect(
      hooks.before(
        authContext({
          body: { email: 'user@example.com' },
          path: '/sign-in/email',
        })
      )
    ).resolves.toBeUndefined();
  });

  it('visitor skips sign-in and sign-up preflight without email', async () => {
    await hooks.before(
      authContext({
        body: { email: '' },
        path: '/sign-in/email',
      })
    );
    await hooks.before(
      authContext({
        body: { email: null },
        path: '/sign-up/email',
      })
    );

    expect(count).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('visitor cannot sign up with a duplicate normalized email', async () => {
    findUnique.mockResolvedValue({ id: 'user_1' });

    await expect(
      hooks.before(
        authContext({
          body: { email: ' Existing.User@Example.COM ' },
          path: '/sign-up/email',
        })
      )
    ).rejects.toMatchObject(emailExistsError);

    expect(findUnique).toHaveBeenCalledWith({
      where: { email: 'existing.user@example.com' },
    });
  });

  it('visitor cannot reset without a string password', async () => {
    await expect(
      hooks.before(
        authContext({
          body: { password: null },
          path: '/email-otp/reset-password',
        })
      )
    ).rejects.toMatchObject(passwordRequiredError);

    expect(assertPasswordNotCompromised).not.toHaveBeenCalled();
  });

  it('visitor cannot reset to a short password before breach lookup', async () => {
    await expect(
      hooks.before(
        authContext({
          body: { password: 'short' },
          path: '/email-otp/reset-password',
        })
      )
    ).rejects.toMatchObject(passwordTooShortError);

    expect(assertPasswordNotCompromised).not.toHaveBeenCalled();
  });

  it('visitor cannot reset to a long password before breach lookup', async () => {
    await expect(
      hooks.before(
        authContext({
          body: { password: 'x'.repeat(129) },
          path: '/email-otp/reset-password',
        })
      )
    ).rejects.toMatchObject(passwordTooLongError);

    expect(assertPasswordNotCompromised).not.toHaveBeenCalled();
  });

  it('visitor checks reset password breach risk for valid length', async () => {
    await hooks.before(
      authContext({
        body: { password: 'valid-password' },
        path: '/email-otp/reset-password',
      })
    );

    expect(assertPasswordNotCompromised).toHaveBeenCalledWith('valid-password');
  });

  it('visitor gets compromised reset password rejection', async () => {
    const compromisedError = new Error('compromised');
    assertPasswordNotCompromisedMock.mockRejectedValue(compromisedError);

    await expect(
      hooks.before(
        authContext({
          body: { password: 'compromised-password' },
          path: '/email-otp/reset-password',
        })
      )
    ).rejects.toBe(compromisedError);
  });
});

describe('signInEmailHooks after sign-in', () => {
  it('sailor failed sign-in records Cloudflare IP', async () => {
    await hooks.after(
      authContext({
        body: { email: ' Failed.User@Example.COM ' },
        path: '/sign-in/email',
        request: requestWithCfIp('203.0.113.42'),
      })
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        email: 'failed.user@example.com',
        ipAddress: '203.0.113.42',
      },
    });
  });

  it('sailor failed sign-in records no IP when request is missing', async () => {
    await hooks.after(
      authContext({
        body: { email: 'failed@example.com' },
        path: '/sign-in/email',
      })
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        email: 'failed@example.com',
        ipAddress: null,
      },
    });
  });

  it('sailor successful sign-in clears failed attempts', async () => {
    await hooks.after(
      authContext({
        body: { email: ' Success.User@Example.COM ' },
        context: { newSession: { id: 'session_1' } },
        path: '/sign-in/email',
      })
    );

    expect(deleteMany).toHaveBeenCalledWith({
      where: { email: 'success.user@example.com' },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('visitor skips failed-attempt tracking without a sign-in email', async () => {
    await hooks.after(
      authContext({
        path: '/session',
      })
    );
    await hooks.after(
      authContext({
        body: { email: '' },
        path: '/sign-in/email',
      })
    );

    expect(create).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('locked-out sailor receives lockout email on fifth recent failure', async () => {
    count.mockResolvedValue(5);

    await hooks.after(
      authContext({
        body: { email: 'locked@example.com' },
        path: '/sign-in/email',
      })
    );

    expect(sendAccountLockedEmail).toHaveBeenCalledTimes(1);
    expect(sendAccountLockedEmail).toHaveBeenCalledWith('locked@example.com');
  });

  it('sailor does not receive lockout email outside fifth recent failure', async () => {
    count.mockResolvedValueOnce(4).mockResolvedValueOnce(6);

    await hooks.after(
      authContext({
        body: { email: 'locked@example.com' },
        path: '/sign-in/email',
      })
    );
    await hooks.after(
      authContext({
        body: { email: 'locked@example.com' },
        path: '/sign-in/email',
      })
    );

    expect(sendAccountLockedEmail).not.toHaveBeenCalled();
  });

  it('locked-out sailor sign-in flow survives lockout email failure', async () => {
    const deliveryError = new Error('mail down');
    count.mockResolvedValue(5);
    sendAccountLockedEmailMock.mockRejectedValue(deliveryError);

    await expect(
      hooks.after(
        authContext({
          body: { email: 'locked@example.com' },
          path: '/sign-in/email',
        })
      )
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      'Failed to send account-locked email:',
      deliveryError
    );
  });
});

describe('signInEmailHooks after change password', () => {
  it('security-notice persona receives password change notice for session email', async () => {
    await hooks.after(
      authContext({
        context: { session: { user: { email: 'user@example.com' } } },
        path: '/change-password',
      })
    );

    expect(sendPasswordChangedNotice).toHaveBeenCalledTimes(1);
    expect(sendPasswordChangedNotice).toHaveBeenCalledWith('user@example.com');
  });

  it('security-notice persona skips password change notice without session email', async () => {
    await hooks.after(
      authContext({
        context: { session: { user: { email: null } } },
        path: '/change-password',
      })
    );

    expect(sendPasswordChangedNotice).not.toHaveBeenCalled();
  });

  it('security-notice persona skips password change notice without session', async () => {
    await hooks.after(
      authContext({
        path: '/change-password',
      })
    );

    expect(sendPasswordChangedNotice).not.toHaveBeenCalled();
  });

  it('security-notice persona skips password change notice with empty session email', async () => {
    await hooks.after(
      authContext({
        context: { session: { user: { email: '' } } },
        path: '/change-password',
      })
    );

    expect(sendPasswordChangedNotice).not.toHaveBeenCalled();
  });

  it('profile owner password change survives notice delivery failure', async () => {
    const deliveryError = new Error('mail down');
    sendPasswordChangedNoticeMock.mockRejectedValue(deliveryError);

    await expect(
      hooks.after(
        authContext({
          context: { session: { user: { email: 'user@example.com' } } },
          path: '/change-password',
        })
      )
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      'Failed to send password-changed notice:',
      deliveryError
    );
  });
});
