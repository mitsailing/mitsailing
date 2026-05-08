import { NextResponse } from 'next/server';
import { unsubscribeNewsletterTokenFromList } from '@/libs/newsletter/newsletterSubscriptions';
import { newsletterManageUrl } from '@/libs/newsletter/newsletterUrls';

function paramFromUrl(request: Request, key: string): string {
  return new URL(request.url).searchParams.get(key)?.trim() ?? '';
}

function jsonString(value: unknown, key: string): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return '';
  }
  const entry = Object.entries(value).find(([entryKey]) => entryKey === key);
  return typeof entry?.[1] === 'string' ? entry[1] : '';
}

async function unsubscribe(request: Request): Promise<{
  listId: string;
  token: string;
}> {
  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body: unknown = await request.json();
      return {
        listId: jsonString(body, 'list'),
        token: jsonString(body, 'token'),
      };
    }
    const body = await request.formData();
    const list = body.get('list');
    const token = body.get('token');
    return {
      listId: typeof list === 'string' ? list : paramFromUrl(request, 'list'),
      token: typeof token === 'string' ? token : paramFromUrl(request, 'token'),
    };
  }
  return {
    listId: paramFromUrl(request, 'list'),
    token: paramFromUrl(request, 'token'),
  };
}

/**
 * RFC 8058 one-click unsubscribe endpoint for newsletter list headers.
 *
 * @param request - Incoming unsubscribe request
 * @returns Empty success response or manage-page redirect for browser GETs
 */
export async function POST(request: Request) {
  const params = await unsubscribe(request);
  if (params.token.length === 0 || params.listId.length === 0) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const subscriber = await unsubscribeNewsletterTokenFromList(
    params.token,
    params.listId
  );
  if (!subscriber) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * Browser fallback for unsubscribe links.
 *
 * @param request - Incoming unsubscribe request
 * @returns Redirect to manage preferences after applying the list unsubscribe
 */
export async function GET(request: Request) {
  const params = await unsubscribe(request);
  if (params.token.length > 0 && params.listId.length > 0) {
    await unsubscribeNewsletterTokenFromList(params.token, params.listId);
  }
  return NextResponse.redirect(newsletterManageUrl(params.token));
}
