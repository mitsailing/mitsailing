import {
  Permission,
  getAppRolePermissions,
  hasPermission,
} from '@/libs/auth/appPermissions';
import { appAuthContextFromSession } from '@/libs/zenstack/authContext';

/** Minimal session fields for deciding whether the global header shows Admin. */
export type AdminHeaderLinkSessionInput = {
  userAppRole: unknown;
  userBanned: unknown;
  userEmailVerified: unknown;
  userId: string | null | undefined;
  impersonatedBy: unknown;
};

/**
 * Whether the marketing header should show the Admin link: signed-in user with
 * any staff/admin role who is not impersonating. Safe for server and client
 * (no `server-only` imports).
 *
 * @param input - User id, app role, and impersonation marker from Better Auth session
 * @returns True when the Admin nav entry should render
 */
export function adminHeaderLinkVisibleFromSession(
  input: AdminHeaderLinkSessionInput
): boolean {
  if (typeof input.userId !== 'string' || input.userId.length === 0) {
    return false;
  }
  const authContext = appAuthContextFromSession({
    session: { impersonatedBy: input.impersonatedBy },
    user: {
      appRole: input.userAppRole,
      banned: input.userBanned,
      emailVerified: input.userEmailVerified,
      id: input.userId,
    },
  });
  if (!authContext) {
    return false;
  }
  return hasPermission(
    getAppRolePermissions(authContext.appRole),
    Permission.ADMIN_VIEW
  );
}

/**
 * Derives admin header link visibility from Better Auth `useSession().data` on
 * the client (untyped session payload).
 *
 * @param data - Client session object or undefined
 * @returns True when the header Admin entry should show for this session
 */
export function adminHeaderLinkVisibleFromClientSessionData(
  data: unknown
): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const { user, session } = data as {
    user?: {
      appRole?: unknown;
      banned?: unknown;
      emailVerified?: unknown;
      id?: unknown;
    };
    session?: { impersonatedBy?: unknown };
  };
  return adminHeaderLinkVisibleFromSession({
    userId: typeof user?.id === 'string' ? user.id : undefined,
    userAppRole: user?.appRole,
    userBanned: user?.banned,
    userEmailVerified: user?.emailVerified,
    impersonatedBy: session?.impersonatedBy,
  });
}
