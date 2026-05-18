import {
  AuthSubject,
  createAuthAbility,
  Permission,
  permissionGrantsForSeed,
} from '@/libs/auth/permissions';
import { normalizeRole } from '@/libs/auth/roles';

/** Minimal session fields for deciding whether the global header shows Admin. */
export type AdminHeaderLinkSessionInput = {
  userId: string | null | undefined;
  userRole: unknown;
  impersonatedBy: unknown;
};

/**
 * Whether the marketing header should show the Admin link: signed-in user with
 * any staff/admin role who is not impersonating. Safe for server and client
 * (no `server-only` imports).
 *
 * @param input - User id, role, and impersonation marker from Better Auth session
 * @returns True when the Admin nav entry should render
 */
export function adminHeaderLinkVisibleFromSession(
  input: AdminHeaderLinkSessionInput
): boolean {
  if (typeof input.userId !== 'string' || input.userId.length === 0) {
    return false;
  }
  const ability = createAuthAbility({
    grants: permissionGrantsForSeed(),
    role: normalizeRole(input.userRole),
    userId: input.userId,
  });
  if (!ability.can(Permission.ADMIN_VIEW, AuthSubject.PERMISSION)) {
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
    user?: { id?: unknown; role?: unknown };
    session?: { impersonatedBy?: unknown };
  };
  return adminHeaderLinkVisibleFromSession({
    userId: typeof user?.id === 'string' ? user.id : undefined,
    userRole: user?.role,
    impersonatedBy: session?.impersonatedBy,
  });
}
