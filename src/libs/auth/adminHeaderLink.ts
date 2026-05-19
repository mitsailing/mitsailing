import {
  Permission,
  getAppRolePermissions,
  hasPermission,
  normalizeAppRole,
} from '@/libs/auth/appPermissions';

/** Minimal session fields for deciding whether the global header shows Admin. */
export type AdminHeaderLinkSessionInput = {
  userAppRole: unknown;
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
  if (
    !hasPermission(
      getAppRolePermissions(normalizeAppRole(input.userAppRole)),
      Permission.ADMIN_VIEW
    )
  ) {
    return false;
  }
  if (input.impersonatedBy) {
    return false;
  }
  return true;
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
    user?: { appRole?: unknown; id?: unknown };
    session?: { impersonatedBy?: unknown };
  };
  return adminHeaderLinkVisibleFromSession({
    userId: typeof user?.id === 'string' ? user.id : undefined,
    userAppRole: user?.appRole,
    impersonatedBy: session?.impersonatedBy,
  });
}
