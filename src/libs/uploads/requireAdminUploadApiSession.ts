import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/libs/auth';
import { normalizeRole, Role } from '@/libs/auth/roles';

/**
 * Ensures the caller is a non-impersonating admin (same bar as {@link requireAdmin}).
 *
 * @returns Either `userId` or an HTTP `NextResponse` to return from the route
 */
export async function requireAdminUploadApiSession(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  if (
    normalizeRole(session.user.role) !== Role.ADMIN ||
    session.session.impersonatedBy
  ) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return { ok: true, userId: session.user.id };
}
