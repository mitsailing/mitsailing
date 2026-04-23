import { detectBot } from '@arcjet/next';
import { getSessionCookie } from 'better-auth/cookies';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import arcjet from '@/libs/Arcjet';
import { routing } from '@/libs/I18nRouting';

const intl = createIntlMiddleware(routing);

const aj = arcjet.withRule(
  detectBot({
    mode: 'LIVE',
    allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:PREVIEW', 'CATEGORY:MONITOR'],
  })
);

// Edge-safe optimistic auth gate. Real session validation still happens at
// the page level via `auth.api.getSession`; middleware only short-circuits
// unauthenticated requests to protected pages so the full redirect dance is
// cheap. Locale handling is delegated to next-intl.
export default async function middleware(request: NextRequest) {
  if (process.env.ARCJET_KEY) {
    const decision = await aj.protect(request);
    if (decision.isDenied()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { pathname } = request.nextUrl;
  const protectedPattern = /^(?:\/[\w-]+)?\/dashboard(?:\/|$)/;
  if (protectedPattern.test(pathname) && !getSessionCookie(request)) {
    const signIn = new URL('/sign-in', request.url);
    signIn.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signIn);
  }

  return intl(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|monitoring|.*\\..*).*)'],
};
