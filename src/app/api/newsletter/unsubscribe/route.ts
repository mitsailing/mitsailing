import { NextResponse } from 'next/server';
import { logger } from '@/libs/Logger';
import { unsubscribeNewsletterTokenFromList } from '@/libs/newsletter/newsletterSubscriptions';
import { newsletterManageUrl } from '@/libs/newsletter/newsletterUrls';

function paramFromUrl(request: Request, key: string): string {
  return new URL(request.url).searchParams.get(key)?.trim() ?? '';
}

function jsonString(value: unknown, key: string): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return '';
  }
  const prop: unknown = Reflect.get(value, key);
  return typeof prop === 'string' ? prop : '';
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
  if (contentType.includes('application/json')) {
    const body: unknown = await request.json();
    return {
      listId: jsonString(body, 'list') || urlParams.listId,
      token: jsonString(body, 'token') || urlParams.token,
    };
  }
  if (
    !contentType.includes('application/x-www-form-urlencoded') &&
    !contentType.includes('multipart/form-data')
  ) {
    throw new TypeError('Unsupported newsletter unsubscribe content type');
  }
  if (urlParams.listId.length > 0 && urlParams.token.length > 0) {
    return urlParams;
  }
  const body = await request.formData();
  const list = body.get('list');
  const token = body.get('token');
  return {
    listId: typeof list === 'string' ? list : urlParams.listId,
    token: typeof token === 'string' ? token : urlParams.token,
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
 * @returns Redirect to manage preferences without mutating subscriptions
 */
export function GET(request: Request) {
  const params = unsubscribeParamsFromUrl(request);
  if (params.token.length === 0) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  return NextResponse.redirect(newsletterManageUrl(params.token));
}
