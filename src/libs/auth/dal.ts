import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { auth } from '@/libs/auth';
import {
  authHrefWithCallback,
  safeAuthCallbackUrl,
} from '@/libs/auth/callbackUrl';
import {
  AuthSubject,
  createAuthAbility,
  Permission,
} from '@/libs/auth/permissions';
import { listRolePermissionGrants } from '@/libs/auth/rolePermissionGrants';
import { normalizeRole, parseRoles, Role } from '@/libs/auth/roles';
import { syncSentryUserFromSession } from '@/libs/sentry-user-server';
import { AppConfig } from '@/utils/AppConfig';
import { getI18nPath } from '@/utils/Helpers';

/**
 * Raw session shape as returned by Better Auth's `getSession`. We re-export
 * it under a stable alias so consumers don't reach into the generated type
 * surface directly.
 */
export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;

/**
 * Narrow view of the authenticated user consumed by server components, per
 * Next.js [DTO guidance](https://nextjs.org/docs/app/building-your-application/authentication#using-data-transfer-objects-dto).
 * Keep this shape minimal; views that need impersonation state read the raw
 * session.
 */
export type CurrentUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: Role;
  /**
   * Pending login email set while a change-email flow is in progress. Null
   * when no change is pending. Cleared automatically by Better Auth's
   * `afterEmailVerification` hook once the new address is confirmed.
   */
  unconfirmedEmail: string | null;
};

/**
 * Request-scoped session read memoized with React `cache` so a single render
 * pass never issues two `auth.api.getSession` calls.
 */
export const getSession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  syncSentryUserFromSession(session);
  return session;
});

/**
 * Bounces already-authenticated users away from auth-only pages (sign-in,
 * sign-up, forgot-password, reset-password, verify-email).
 *
 * @param locale - Active locale used to build the default destination.
 * @param callbackUrl - Optional app-relative path to honour when safe.
 */
export async function redirectIfAuthenticated(
  locale: string = AppConfig.i18n.defaultLocale,
  callbackUrl?: string
): Promise<void> {
  const session = await getSession();
  if (!session?.user?.id) {
    return;
  }
  const homeHref = getI18nPath('/', locale);
  const destination = safeAuthCallbackUrl(callbackUrl, homeHref);
  redirect(destination);
}

/**
 * Requires a signed-in user. Redirects to the locale-aware sign-in page with
 * a `callbackUrl` when unauthenticated.
 *
 * @param locale - Active locale used to build the sign-in URL.
 * @param callbackUrl - App-relative path (must start with `/`) to resume after login.
 * @returns The authenticated session (never resolves when unauthenticated since `redirect` throws).
 */
export async function verifySession(
  locale: string = AppConfig.i18n.defaultLocale,
  callbackUrl?: string
): Promise<NonNullable<AuthSession>> {
  const session = await getSession();

  if (!session?.user?.id) {
    const signIn = getI18nPath('/login', locale);
    redirect(authHrefWithCallback(signIn, callbackUrl));
  }

  return session;
}

export async function requireAnyPermission(
  permissions: readonly Permission[],
  locale: string = AppConfig.i18n.defaultLocale
): Promise<NonNullable<AuthSession>> {
  const homeHref = getI18nPath('/', locale);
  const session = await verifySession(locale, homeHref);
  const roles = parseRoles(session.user.role);

  if (session.session.impersonatedBy) {
    redirect(homeHref);
  }

  const grants = roles.includes(Role.ADMIN)
    ? []
    : await listRolePermissionGrants();
  const ability = createAuthAbility({
    grants,
    roles,
    userId: session.user.id,
  });
  if (
    !permissions.some((permission) =>
      ability.can(permission, AuthSubject.PERMISSION)
    )
  ) {
    redirect(homeHref);
  }
  return session;
}

export async function requirePermission(
  permission: Permission,
  locale: string = AppConfig.i18n.defaultLocale
): Promise<NonNullable<AuthSession>> {
  const session = await requireAnyPermission([permission], locale);
  return session;
}

/**
 * Requires an admin who is not currently impersonating another user.
 * Redirects to the site home otherwise so admins never land on pages they are
 * forbidden to view.
 *
 * @param locale - Active locale used for redirect paths.
 * @returns The authenticated admin session.
 */
export async function requireAdmin(
  locale: string = AppConfig.i18n.defaultLocale
): Promise<NonNullable<AuthSession>> {
  const session = await requirePermission(Permission.ADMIN_VIEW, locale);
  return session;
}

function toCurrentUser(session: NonNullable<AuthSession>): CurrentUser {
  const { user } = session;
  const pending = (user as { unconfirmedEmail?: unknown }).unconfirmedEmail;
  return {
    id: user.id,
    email: typeof user.email === 'string' ? user.email : null,
    name: typeof user.name === 'string' ? user.name : null,
    role: normalizeRole(user.role),
    unconfirmedEmail: typeof pending === 'string' ? pending : null,
  };
}

/**
 * Projects the session onto a minimal `CurrentUser` DTO.
 *
 * @returns The current user's DTO, or `null` when not signed in.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session?.user?.id) {
    return null;
  }
  return toCurrentUser(session);
}

/**
 * Same as {@link getCurrentUser} but redirects to sign-in when unauthenticated.
 *
 * @param locale - Active locale used to build the sign-in URL.
 * @param callbackUrl - App-relative path (must start with `/`) to resume after login.
 * @returns The current user's DTO (never resolves when unauthenticated).
 */
export async function requireCurrentUser(
  locale: string = AppConfig.i18n.defaultLocale,
  callbackUrl?: string
): Promise<CurrentUser> {
  const session = await verifySession(locale, callbackUrl);
  return toCurrentUser(session);
}
