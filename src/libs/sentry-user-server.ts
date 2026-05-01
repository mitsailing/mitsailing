import 'server-only';
import * as Sentry from '@sentry/nextjs';

type SessionLike = {
  user?: {
    id?: unknown;
    email?: unknown;
  } | null;
} | null;

/**
 * Attaches the signed-in Better Auth user to the Sentry scope for this request.
 * Clears user when there is no session.
 *
 * @param session - Result of `auth.api.getSession`, or null when signed out.
 * @returns void
 */
export function syncSentryUserFromSession(session: SessionLike): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
    return;
  }
  const user = session?.user;
  const id = typeof user?.id === 'string' ? user.id : undefined;
  if (!id) {
    Sentry.setUser(null);
    return;
  }
  const email = typeof user?.email === 'string' ? user.email : undefined;
  Sentry.setUser({ id, email });
}
