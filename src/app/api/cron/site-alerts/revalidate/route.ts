import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { Env } from '@/libs/Env';
import { SITE_ALERTS_CACHE_TAG } from '@/libs/mit-sailing/siteAlertQueries';

function cronAuthorized(request: Request): boolean {
  const token = Env.CRON_SECRET;
  if (!token) {
    return false;
  }
  return request.headers.get('authorization') === `Bearer ${token}`;
}

/**
 * Clears cached active site alerts for midnight visibility rollovers.
 *
 * @param request - Cron request carrying the bearer token
 * @returns JSON result
 */
export function POST(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  revalidateTag(SITE_ALERTS_CACHE_TAG, { expire: 0 });
  return NextResponse.json({ ok: true });
}
