import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/libs/auth/dal';
import { getBaseUrl } from '@/utils/Helpers';

const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

/**
 * Accepts image uploads for the React Email preview/editor workflow and stores
 * files under `/public/email-assets`.
 * @param request - Multipart request with `file` field.
 * @returns JSON payload with public `url` or an error status.
 */
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Expected file field' }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type' },
      { status: 415 }
    );
  }

  const safeBase = path.basename(file.name).replaceAll(/[^\w.-]+/g, '_');
  const filename = `${Date.now()}-${safeBase || 'upload.bin'}`;
  const dir = path.join(process.cwd(), 'public', 'email-assets');
  await mkdir(dir, { recursive: true });

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), bytes);

  const base = getBaseUrl().replace(/\/$/, '');
  const url = `${base}/email-assets/${filename}`;

  return NextResponse.json({ url });
}
