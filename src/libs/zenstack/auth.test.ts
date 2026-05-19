import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@/libs/auth/roles';
import type { ZenStackDb } from '@/libs/zenstack/auth';
import {
  appAuthContextFromSession,
  appSessionDataForBetterAuth,
} from '@/libs/zenstack/authContext';

const zenstackMocks = vi.hoisted(() => {
  const setAuth = vi.fn((authContext: unknown) => ({ authContext }));
  const policyClient = { $setAuth: setAuth };
  const use = vi.fn(() => policyClient);
  const transaction = vi.fn();
  const authClient = { $transaction: transaction, $use: use };

  return {
    Pool: vi.fn(function Pool() {}),
    PolicyPlugin: vi.fn(function PolicyPlugin() {
      return { id: 'policy-plugin' };
    }),
    PostgresDialect: vi.fn(function PostgresDialect(config: unknown) {
      return { config };
    }),
    ZenStackClient: vi.fn(function ZenStackClient() {
      return authClient;
    }),
    authClient,
    policyClient,
    setAuth,
    transaction,
    use,
    zenstackAdapter: vi.fn(() => ({ id: 'better-auth-zenstack-adapter' })),
  };
});

vi.mock('@zenstackhq/better-auth', () => ({
  zenstackAdapter: zenstackMocks.zenstackAdapter,
}));

vi.mock('@zenstackhq/orm', () => ({
  ZenStackClient: zenstackMocks.ZenStackClient,
}));

vi.mock('@zenstackhq/orm/dialects/postgres', () => ({
  PostgresDialect: zenstackMocks.PostgresDialect,
}));

vi.mock('@zenstackhq/plugin-policy', () => ({
  PolicyPlugin: zenstackMocks.PolicyPlugin,
}));

vi.mock('pg', () => ({
  Pool: zenstackMocks.Pool,
}));

vi.mock('../../../zenstack/schema', () => ({
  schema: { id: 'generated-schema' },
}));

vi.mock('@/libs/Env', () => ({
  Env: { DATABASE_URL: 'postgres://test' },
}));

vi.mock('server-only', () => ({}));

function session(props?: {
  appRole?: unknown;
  banned?: unknown;
  emailVerified?: unknown;
  id?: unknown;
  impersonatedBy?: unknown;
}) {
  const overrides = props ?? {};
  return {
    session: {
      impersonatedBy: Object.hasOwn(overrides, 'impersonatedBy')
        ? overrides.impersonatedBy
        : null,
    },
    user: {
      appRole: Object.hasOwn(overrides, 'appRole')
        ? overrides.appRole
        : Role.ADMIN,
      banned: Object.hasOwn(overrides, 'banned') ? overrides.banned : false,
      emailVerified: Object.hasOwn(overrides, 'emailVerified')
        ? overrides.emailVerified
        : true,
      id: Object.hasOwn(overrides, 'id') ? overrides.id : 'user-1',
      role: Role.USER,
    },
  };
}

function expectZenStackDb(_client: ZenStackDb): void {}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  globalThis.cachedPool = undefined;
  globalThis.cachedZenStack = undefined;
  globalThis.cachedZenStackPolicy = undefined;
});

describe('appAuthContextFromSession', () => {
  it('returns app auth context for verified unbanned sessions', () => {
    expect(appAuthContextFromSession(session())).toEqual({
      appRole: Role.ADMIN,
      id: 'user-1',
    });
  });

  it.each([
    ['banned user', { banned: true }],
    ['unverified user', { emailVerified: false }],
    ['impersonated session', { impersonatedBy: 'admin-1' }],
    ['missing id', { id: null }],
    ['unknown app role', { appRole: 'captain' }],
  ])('fails closed for %s', (_name, overrides) => {
    expect(appAuthContextFromSession(session(overrides))).toBeNull();
  });

  it.each([
    ['missing impersonation marker', undefined],
    ['empty impersonation marker', ''],
    ['non-string impersonation marker', false],
  ])('fails closed for %s', (_name, impersonatedBy) => {
    const payload = session();
    if (impersonatedBy === undefined) {
      delete payload.session.impersonatedBy;
    } else {
      payload.session.impersonatedBy = impersonatedBy;
    }

    expect(appAuthContextFromSession(payload)).toBeNull();
  });
});

describe('appSessionDataForBetterAuth', () => {
  it('exposes app auth fields and mirrors admin role only when safe', () => {
    expect(appSessionDataForBetterAuth(session()).user).toEqual(
      expect.objectContaining({
        appRole: Role.ADMIN,
        banned: false,
        emailVerified: true,
        role: Role.ADMIN,
      })
    );
  });

  it('mirrors unsafe or non-admin sessions to user role', () => {
    expect(
      appSessionDataForBetterAuth(session({ appRole: Role.DOCK_STAFF })).user
        .role
    ).toBe(Role.USER);
    expect(
      appSessionDataForBetterAuth(session({ banned: true })).user.role
    ).toBe(Role.USER);
  });

  it('mirrors malformed sessions to user role when ban flag is absent', () => {
    expect(
      appSessionDataForBetterAuth({
        session: { impersonatedBy: null },
        user: {
          appRole: Role.ADMIN,
          emailVerified: true,
          id: 'admin-1',
        },
      }).user.role
    ).toBe(Role.USER);
  });

  it.each([
    ['missing impersonation marker', undefined],
    ['empty impersonation marker', ''],
    ['non-string impersonation marker', false],
  ])('mirrors %s to user role', (_name, impersonatedBy) => {
    const payload = session();
    if (impersonatedBy === undefined) {
      delete payload.session.impersonatedBy;
    } else {
      payload.session.impersonatedBy = impersonatedBy;
    }

    expect(appSessionDataForBetterAuth(payload).user.role).toBe(Role.USER);
  });

  it.each([
    ['missing impersonation marker', undefined],
    ['empty impersonation marker', ''],
    ['non-string impersonation marker', false],
  ])(
    'keeps normalized %s rejected by app auth context',
    (_name, impersonatedBy) => {
      const payload = session();
      if (impersonatedBy === undefined) {
        delete payload.session.impersonatedBy;
      } else {
        payload.session.impersonatedBy = impersonatedBy;
      }

      expect(
        appAuthContextFromSession(appSessionDataForBetterAuth(payload))
      ).toBeNull();
    }
  );
});

describe('ZenStack auth client helpers', () => {
  it('creates Better Auth adapter from unprotected ZenStack client', async () => {
    const { getAuthZenStack, getBetterAuthZenStackAdapter } =
      await import('@/libs/zenstack/auth');

    const client = getAuthZenStack();
    expectZenStackDb(client);

    expect(getAuthZenStack()).toBe(client);
    expect(zenstackMocks.ZenStackClient).toHaveBeenCalledOnce();
    expect(zenstackMocks.PostgresDialect).toHaveBeenCalledOnce();
    expect(zenstackMocks.Pool).toHaveBeenCalledWith({
      connectionString: 'postgres://test',
    });

    expect(getBetterAuthZenStackAdapter()).toEqual({
      id: 'better-auth-zenstack-adapter',
    });
    expect(zenstackMocks.zenstackAdapter).toHaveBeenCalledWith(client, {
      provider: 'postgresql',
    });
  });

  it('sets app auth context on policy protected ZenStack client', async () => {
    const { getZenStack, zenstackForAuthContext } =
      await import('@/libs/zenstack/auth');
    const authContext = { appRole: Role.ADMIN, id: 'admin-1' };

    expect(getZenStack()).toBe(zenstackMocks.policyClient);
    expect(zenstackMocks.PolicyPlugin).toHaveBeenCalledOnce();
    expect(zenstackMocks.use).toHaveBeenCalledWith({ id: 'policy-plugin' });
    expect(zenstackForAuthContext(authContext)).toEqual({ authContext });
    expect(zenstackMocks.setAuth).toHaveBeenCalledWith(authContext);
  });
});
