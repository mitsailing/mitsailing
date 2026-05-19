import type { BetterAuthOptions } from 'better-auth';
import type {
  AdapterFactory,
  DBAdapter,
  DBTransactionAdapter,
  JoinOption,
  Where,
} from 'better-auth/adapters';
import type { Role } from '@/libs/auth/roles';
import { isRole, Role as AppRole } from '@/libs/auth/roles';
import type { AuthContext } from '../../../zenstack/models';

export type AppAuthContext = Pick<AuthContext, 'appRole' | 'id'>;
type AppBetterAuthSession = Record<string, unknown> & {
  impersonatedBy: string | null;
};
type AppBetterAuthUser = Record<string, unknown> & {
  appRole: Role;
  banned: boolean;
  emailVerified: boolean;
  role: typeof AppRole.ADMIN | typeof AppRole.USER;
};
type BetterAuthAuthorizationRole = typeof AppRole.ADMIN | typeof AppRole.USER;
type BetterAuthFindOneInput = {
  join?: JoinOption;
  model: string;
  select?: string[];
  where: Where[];
};
const INVALID_IMPERSONATION_MARKER = '__invalid_impersonation_marker__';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function appAuthContextFromSession(
  session: unknown
): AppAuthContext | null {
  if (
    !(isRecord(session) && isRecord(session.user) && isRecord(session.session))
  ) {
    return null;
  }

  const { user } = session;
  if (
    typeof user.id !== 'string' ||
    user.id.length === 0 ||
    !isRole(user.appRole) ||
    user.emailVerified !== true ||
    user.banned !== false
  ) {
    return null;
  }

  if (session.session.impersonatedBy !== null) {
    return null;
  }

  return {
    appRole: user.appRole,
    id: user.id,
  };
}

function betterAuthRoleForAppSession(
  session: unknown
): BetterAuthAuthorizationRole {
  const safeContext = appAuthContextFromSession(session);
  return safeContext?.appRole === AppRole.ADMIN ? AppRole.ADMIN : AppRole.USER;
}

function normalizeBetterAuthUserRole(
  user: Record<string, unknown>,
  session: Record<string, unknown>
): Record<string, unknown> & { role: BetterAuthAuthorizationRole } {
  return {
    ...user,
    role: betterAuthRoleForAppSession({ session, user }),
  };
}

function normalizeBetterAuthAdapterOutput(value: unknown): void {
  if (!isRecord(value)) {
    return;
  }

  if (isRecord(value.user)) {
    value.user = normalizeBetterAuthUserRole(value.user, value);
    return;
  }

  if ('appRole' in value || 'role' in value) {
    value.role = betterAuthRoleForAppSession({
      session: { impersonatedBy: null },
      user: value,
    });
  }
}

function normalizedImpersonatedBy(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  return value === null ? null : INVALID_IMPERSONATION_MARKER;
}

function withAppRoleBetterAuthReadAdapter<Options extends BetterAuthOptions>(
  adapter: DBAdapter<Options>
): DBAdapter<Options>;
function withAppRoleBetterAuthReadAdapter<Options extends BetterAuthOptions>(
  adapter: DBTransactionAdapter<Options>
): DBTransactionAdapter<Options>;
function withAppRoleBetterAuthReadAdapter<Options extends BetterAuthOptions>(
  adapter: DBAdapter<Options> | DBTransactionAdapter<Options>
): DBAdapter<Options> | DBTransactionAdapter<Options> {
  return {
    ...adapter,
    async findOne<T>(input: BetterAuthFindOneInput): Promise<T | null> {
      const result = await adapter.findOne<T>(input);
      normalizeBetterAuthAdapterOutput(result);
      return result;
    },
  } as DBAdapter<Options> | DBTransactionAdapter<Options>;
}

export function withAppRoleBetterAuthAdapter<Options extends BetterAuthOptions>(
  adapterFactory: AdapterFactory<Options>
): AdapterFactory<Options> {
  return (options) => {
    const adapter = adapterFactory(options);
    const wrappedAdapter = withAppRoleBetterAuthReadAdapter(adapter);
    return {
      ...wrappedAdapter,
      transaction: async (runTransaction) => {
        await Promise.resolve();
        return adapter.transaction(async (tx) => {
          await Promise.resolve();
          return runTransaction(withAppRoleBetterAuthReadAdapter(tx));
        });
      },
    };
  };
}

export function appSessionDataForBetterAuth<
  T extends { session?: unknown; user?: unknown },
>(
  payload: T
): T & {
  session: AppBetterAuthSession;
  user: AppBetterAuthUser;
} {
  const user = isRecord(payload.user) ? payload.user : {};
  const session = isRecord(payload.session) ? payload.session : {};
  const appRole = isRole(user.appRole) ? user.appRole : AppRole.USER;
  const rawImpersonatedBy = session.impersonatedBy;
  const impersonatedBy = normalizedImpersonatedBy(rawImpersonatedBy);
  const safeContext = appAuthContextFromSession({
    session: {
      ...session,
      impersonatedBy: rawImpersonatedBy,
    },
    user: {
      ...user,
      appRole,
      banned: user.banned,
      emailVerified: user.emailVerified,
    },
  });
  const role =
    safeContext?.appRole === AppRole.ADMIN ? AppRole.ADMIN : AppRole.USER;

  return {
    ...payload,
    session: {
      ...session,
      impersonatedBy,
    },
    user: {
      ...user,
      appRole,
      banned: user.banned === true,
      emailVerified: user.emailVerified === true,
      role,
    },
  };
}
