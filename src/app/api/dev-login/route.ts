import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/libs/auth';
import { safeAuthCallbackUrl } from '@/libs/auth/callbackUrl';
import {
  devAuthDefaultEmail,
  devAuthDefaultPassword,
  isDevAuthShortcutEnabled,
} from '@/libs/auth/devAuthShortcut';
import { normalizeEmailAddress } from '@/utils/emailValidation';
import { getBaseUrl } from '@/utils/Helpers';

function disabledDevLoginResponse() {
  return new NextResponse(null, { status: 404 });
}

function unauthorizedDevLoginResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function devLoginCredentials(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return {
    email: normalizeEmailAddress(
      params.get('email')?.trim() ?? devAuthDefaultEmail
    ),
    password: params.get('password') ?? devAuthDefaultPassword,
    redirectPath: safeAuthCallbackUrl(params.get('redirect'), '/'),
  };
}

function redirectWithAuthCookies(props: {
  authResponse: Response;
  redirectPath: string;
}) {
  const destination = new URL(props.redirectPath, getBaseUrl());
  const response = NextResponse.redirect(destination);

  for (const cookie of props.authResponse.headers.getSetCookie()) {
    response.headers.append('Set-Cookie', cookie);
  }

  return response;
}

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
    return disabledDevLoginResponse();
  }

  const credentials = devLoginCredentials(request);

  const authResponse = await auth.api.signInEmail({
    body: {
      email: credentials.email,
      password: credentials.password,
    },
    asResponse: true,
  });

  if (!authResponse.ok) {
    return unauthorizedDevLoginResponse();
  }

  return redirectWithAuthCookies({
    authResponse,
    redirectPath: credentials.redirectPath,
  });
}
