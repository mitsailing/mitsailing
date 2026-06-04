import { NextResponse } from 'next/server';
import { logger } from '@/libs/Logger';
import { unsubscribeNewsletterTokenFromList } from '@/libs/newsletter/newsletterSubscriptions';
import { newsletterManageUrl } from '@/libs/newsletter/newsletterUrls';

function paramFromUrl(request: Request, key: string): string {
  return new URL(request.url).searchParams.get(key)?.trim() ?? '';
}

function unsubscribeParamsFromUrl(request: Request): {
  listId: string;
  token: string;
} {
  return {
    listId: paramFromUrl(request, 'list'),
    token: paramFromUrl(request, 'token'),
  };
}

async function unsubscribeParamsFromPost(request: Request): Promise<{
  listId: string;
  token: string;
}> {
  const urlParams = unsubscribeParamsFromUrl(request);
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('text/plain')) {
    const rawBody = await request.text();
    const body = rawBody.trim();
    if (body !== 'List-Unsubscribe=One-Click') {
      throw new TypeError('Unsupported newsletter unsubscribe semantics');
    }
    return urlParams;
  }
  if (
    !contentType.includes('application/x-www-form-urlencoded') &&
    !contentType.includes('multipart/form-data')
  ) {
    throw new TypeError('Unsupported newsletter unsubscribe content type');
  }
  const body = await request.formData();
  if (body.get('List-Unsubscribe') !== 'One-Click') {
    throw new TypeError('Unsupported newsletter unsubscribe semantics');
  }
  const list = body.get('list');
  const token = body.get('token');
  return {
    listId: typeof list === 'string' ? list.trim() : urlParams.listId,
    token: typeof token === 'string' ? token.trim() : urlParams.token,
  };
}

/**
 * RFC 8058 one-click unsubscribe endpoint for newsletter list headers.
 *
 * @param request - Incoming unsubscribe request
 * @returns Empty success response or manage-page redirect for browser GETs
 */
export async function POST(request: Request) {
  let params: { listId: string; token: string };
  try {
    params = await unsubscribeParamsFromPost(request);
  } catch (error) {
    logger.warn('Failed to parse newsletter unsubscribe request', { error });
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (params.token.length === 0 || params.listId.length === 0) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  let subscriber: Awaited<
    ReturnType<typeof unsubscribeNewsletterTokenFromList>
  >;
  try {
    subscriber = await unsubscribeNewsletterTokenFromList(
      params.token,
      params.listId
    );
  } catch (error) {
    logger.error('Failed to unsubscribe newsletter token: {error}', {
      error,
      listId: params.listId,
    });
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
  if (!subscriber) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * Browser fallback for unsubscribe links.
 *
 * @param request - Incoming unsubscribe request
 * @returns Redirect to manage preferences after unsubscribing the selected list
 */
export async function GET(request: Request) {
  const params = unsubscribeParamsFromUrl(request);
  if (params.token.length === 0 || params.listId.length === 0) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    await unsubscribeNewsletterTokenFromList(params.token, params.listId);
  } catch (error) {
    logger.error('Failed to unsubscribe newsletter token: {error}', {
      error,
      listId: params.listId,
    });
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
  }
  return NextResponse.redirect(
    newsletterManageUrl(params.token, {
      unsubscribedListId: params.listId,
    })
  );
}
