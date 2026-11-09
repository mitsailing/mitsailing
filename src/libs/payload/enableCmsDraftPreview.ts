'use server';

import { draftMode } from 'next/headers';
import { getSession } from '@/libs/auth/dal';
import { sessionCanPreviewCmsDrafts } from '@/libs/payload/cmsPreviewAccess';

/**
 * Turns on Next draft mode for a signed-in CMS session.
 *
 * Live preview iframes the public URL, so the page asks for draft mode when
 * the admin posts a preview message. Logged-out callers leave draft mode off.
 *
 * @returns Whether draft mode was enabled
 */
export async function enableCmsDraftPreview(): Promise<boolean> {
  const session = await getSession();
  if (!sessionCanPreviewCmsDrafts(session?.user)) {
    return false;
  }
  const draft = await draftMode();
  draft.enable();
  return true;
}
