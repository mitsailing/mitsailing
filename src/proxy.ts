import createIntlMiddleware from 'next-intl/middleware';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/libs/auth';
import { safeAuthCallbackUrl } from '@/libs/auth/callbackUrl';
import { routing } from '@/libs/I18nRouting';
import { resolveRedirectDestination } from '@/libs/payload/resolveRedirectDestination';

const intl = createIntlMiddleware(routing);

// Next.js 16+ runs Proxy on the Node.js runtime by default, so we can call
// `auth.api.getSession` for protected paths. Pages and server actions still
// enforce auth (see `verifySession` / DAL); this layer only redirects early.
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const redirectDestination = await resolveRedirectDestination(pathname);
  if (redirectDestination) {
    if (
      redirectDestination.startsWith('/') &&
      !redirectDestination.startsWith('//')
    ) {
      return NextResponse.redirect(
        new URL(redirectDestination, request.url),
        301
      );
    }
    return NextResponse.redirect(redirectDestination, 301);
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
  // Exclude Payload admin, REST, and the draft preview route from next-intl.
  matcher: [
    '/((?!api|cms|cms-api|next/preview|_next|_vercel|monitoring|.*\\..*).*)',
  ],
};
