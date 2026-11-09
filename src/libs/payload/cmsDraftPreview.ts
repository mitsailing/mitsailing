import 'server-only';
import { draftMode } from 'next/headers';
import { cache } from 'react';
import { getSession } from '@/libs/auth/dal';
import { sessionCanPreviewCmsDrafts } from '@/libs/payload/cmsPreviewAccess';

async function cmsDraftPreviewEnabledUnchecked(): Promise<boolean> {
  const { isEnabled } = await draftMode();
  if (!isEnabled) {
    return false;
  }
  const session = await getSession();
  return sessionCanPreviewCmsDrafts(session?.user);
}

/**
 * True only when Next draft mode is on and the request is still a CMS session.
 *
 * Logged-out visitors keep the published query even if a draft cookie is left behind.
 *
 * @returns Whether the catch-all should load `draft: true`
 */
export const cmsDraftPreviewEnabled = cache(cmsDraftPreviewEnabledUnchecked);
