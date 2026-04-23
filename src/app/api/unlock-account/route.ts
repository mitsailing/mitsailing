import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyUnlockAccountToken } from '@/libs/auth/unlock-token';
import { prisma } from '@/libs/DB';
import { AppConfig } from '@/utils/AppConfig';
import { getBaseUrl, getI18nPath } from '@/utils/Helpers';

/**
 * Terminates a Devise-Lockable-style account lock.
 *
 * Flow:
 *   1. Email carries `?token=<signed JWT>` (see `createUnlockAccountToken`).
 *   2. Click hits this route; we verify the signature + expiry + bound intent.
 *   3. On success, delete every `FailedLoginAttempt` row for that address so
 *      the lockout window collapses immediately, and redirect to the sign-in
 *      page with `?unlocked=1` so the UI can show a confirmation banner.
 *   4. On failure, redirect to sign-in with `?error=unlock_invalid` so the
 *      user gets feedback instead of a bare error page.
 *
 * We swallow token-verification errors inside `verifyUnlockAccountToken` and
 * surface a single error banner; leaking a distinction between "expired",
 * "tampered", and "wrong action" would help attackers profile the scheme.
 *
 * @param request - Incoming request carrying the `token` query parameter.
 * @returns Redirect to the sign-in page with a success or error flag.
 */
export async function GET(request: NextRequest) {
  const signInUrl = `${getBaseUrl()}${getI18nPath('/sign-in', AppConfig.i18n.defaultLocale)}`;

  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(`${signInUrl}?error=unlock_invalid`);
  }

  const verified = await verifyUnlockAccountToken(token);
  if (!verified) {
    return NextResponse.redirect(`${signInUrl}?error=unlock_invalid`);
  }

  await prisma.failedLoginAttempt.deleteMany({
    where: { email: verified.email },
  });

  return NextResponse.redirect(`${signInUrl}?unlocked=1`);
}
