import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { Env } from '@/libs/Env';
import { NEWSLETTER_ARCHIVE_PATH } from '@/libs/newsletter/newsletterArchiveCache';

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  return authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;
}

export function POST(request: Request) {
  if (bearerToken(request) !== Env.BETTER_AUTH_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  revalidatePath(NEWSLETTER_ARCHIVE_PATH);
  return NextResponse.json({ ok: true });
}
