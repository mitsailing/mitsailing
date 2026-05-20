import { detectBot } from '@arcjet/next';
import createIntlMiddleware from 'next-intl/middleware';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import arcjet from '@/libs/Arcjet';
import { auth } from '@/libs/auth';
import { safeAuthCallbackUrl } from '@/libs/auth/callbackUrl';
import { routing } from '@/libs/I18nRouting';
import { resolveLegacyRedirect } from '@/libs/mit-sailing/legacyRedirects';

const intl = createIntlMiddleware(routing);

const aj = arcjet.withRule(
  detectBot({
    mode: 'LIVE',
    allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:PREVIEW', 'CATEGORY:MONITOR'],
  })
);

// Next.js 16+ runs Proxy on the Node.js runtime by default, so we can call
// `auth.api.getSession` for protected paths. Pages and server actions still
// enforce auth (see `verifySession` / DAL); this layer only redirects early.
export default async function proxy(request: NextRequest) {
  if (process.env.ARCJET_KEY) {
    const decision = await aj.protect(request);
    if (decision.isDenied()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { pathname } = request.nextUrl;
  const legacyRedirect = await resolveLegacyRedirect({
    locale: routing.defaultLocale,
    pathname,
  });
  if (legacyRedirect) {
    return NextResponse.redirect(new URL(legacyRedirect, request.url), 308);
  }

  const protectedPattern = /^(?:\/[\w-]+)?\/(?:account|profile)(?:\/|$)/;
  if (protectedPattern.test(pathname)) {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) {
      const signIn = new URL('/login', request.url);
      const callbackPath = `${pathname}${request.nextUrl.search}`;
      signIn.searchParams.set('callbackUrl', safeAuthCallbackUrl(callbackPath));
      return NextResponse.redirect(signIn);
    }
  }

  return intl(request);
}

export const config = {
  matcher: [
    '/((?!api|_next|_vercel|monitoring|.*\\..*).*)',
    '/((?!api|_next|_vercel|monitoring).+\\.(?:php|html?))',
  ],
};
