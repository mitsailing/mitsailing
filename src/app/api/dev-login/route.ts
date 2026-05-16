import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/libs/auth';
import { safeAuthCallbackUrl } from '@/libs/auth/callbackUrl';
import {
  devAuthDefaultEmail,
  devAuthDefaultPassword,
  isDevAuthShortcutEnabled,
} from '@/libs/auth/devAuthShortcut';
import { normalizeMarketingEmail } from '@/utils/emailValidation';
import { getBaseUrl } from '@/utils/Helpers';

/**
 * Dev-only one-step sign-in for browser automation on `npm run dev`.
 *
 * Returns 404 when {@link isDevAuthShortcutEnabled} is false (including under
 * Playwright e2e). Does not replace `/login` or sign-up flows in tests.
 *
 * @param request - GET with optional `email`, `password`, and `redirect` query params.
 * @returns Redirect with session cookies, 401 on bad credentials, or 404 when disabled.
 */
export async function GET(request: NextRequest) {
  if (!isDevAuthShortcutEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  const params = request.nextUrl.searchParams;
  const email = normalizeMarketingEmail(
    params.get('email')?.trim() ?? devAuthDefaultEmail
  );
  const password = params.get('password') ?? devAuthDefaultPassword;
  const redirectPath = safeAuthCallbackUrl(params.get('redirect'), '/');

  const authResponse = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });

  if (!authResponse.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const destination = new URL(redirectPath, getBaseUrl());
  const response = NextResponse.redirect(destination);

  for (const cookie of authResponse.headers.getSetCookie()) {
    response.headers.append('Set-Cookie', cookie);
  }

  return response;
}
