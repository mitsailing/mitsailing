'use server';

import { cookies } from 'next/headers';
import { NEWS_BANNER_COLLAPSE_COOKIE } from '@/libs/mit-sailing/newsBannerCollapse';

const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

/**
 * Saves or clears the visitor's collapsed news banner.
 *
 * @param signature Current banner signature when collapsing, or null when opening
 */
export async function setNewsBannerCollapsed(signature: string | null) {
  const cookieStore = await cookies();
  if (!signature) {
    cookieStore.delete(NEWS_BANNER_COLLAPSE_COOKIE);
    return;
  }
  cookieStore.set(NEWS_BANNER_COLLAPSE_COOKIE, signature, {
    maxAge: MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
  });
}
