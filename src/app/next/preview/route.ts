import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import { isSafeCmsAppPath } from '@/libs/mit-sailing/cmsHref';
import { getPayloadClient } from '@/libs/payload/getPayloadClient';
import { payloadPreviewSecretMatches } from '@/libs/payload/previewSecret';

/**
 * Enables Next draft mode for a signed-in CMS user, then redirects to the page.
 *
 * Logged-out requests are rejected and draft mode is left off.
 *
 * @param req - GET with `path` and `previewSecret`
 * @returns Error response, or a redirect to the public path
 */
export async function GET(req: Request): Promise<Response> {
  const payload = await getPayloadClient();
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');
  const previewSecret = searchParams.get('previewSecret');

  if (!payloadPreviewSecretMatches(previewSecret)) {
    return new Response('You are not allowed to preview this page', {
      status: 403,
    });
  }

  if (!path) {
    return new Response('Insufficient search params', { status: 404 });
  }

  if (!isSafeCmsAppPath(path)) {
    return new Response(
      'This endpoint can only be used for relative previews',
      { status: 500 }
    );
  }

  let user: unknown;
  try {
    ({ user } = await payload.auth({ headers: req.headers }));
  } catch (error) {
    payload.logger.error(
      { err: error },
      'Error verifying token for live preview'
    );
    return new Response('You are not allowed to preview this page', {
      status: 403,
    });
  }

  const draft = await draftMode();
  if (!user) {
    draft.disable();
    return new Response('You are not allowed to preview this page', {
      status: 403,
    });
  }

  draft.enable();
  redirect(path);
}
