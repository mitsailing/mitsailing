import { createHash, timingSafeEqual } from 'node:crypto';
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

function tokenDigest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function matchesRevalidationSecret(token: string | null): boolean {
  if (!token || !Env.NEWSLETTER_REVALIDATE_SECRET) {
    return false;
  }

  return timingSafeEqual(
    tokenDigest(token),
    tokenDigest(Env.NEWSLETTER_REVALIDATE_SECRET)
  );
}

export function POST(request: Request) {
  if (!matchesRevalidationSecret(bearerToken(request))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  revalidatePath(NEWSLETTER_ARCHIVE_PATH);
  return NextResponse.json({ ok: true });
}
