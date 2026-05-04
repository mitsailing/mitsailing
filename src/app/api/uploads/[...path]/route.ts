import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { requireAdminUploadApiSession } from '@/libs/uploads/requireAdminUploadApiSession';
import { resolveUploadBaseDir } from '@/libs/uploads/resolveUploadBaseDir';
import { pathSegmentsToStorageKey } from '@/libs/uploads/storageKey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { path?: string[] };

function etagForSha256(sha256: string): string {
  return `"${sha256}"`;
}

function ifNoneMatchApplies(header: string | null, etag: string): boolean {
  if (header === null) {
    return false;
  }
  const normalized = header.trim();
  if (normalized === '*' || normalized.length === 0) {
    return false;
  }
  for (const token of normalized.split(',')) {
    const t = token.trim();
    const candidate = t.startsWith('W/') ? t.slice(2).trim() : t;
    if (candidate === etag) {
      return true;
    }
  }
  return false;
}

/**
 * Returns an uploaded blob for admins only; path must match a known `Upload` row.
 *
 * @param request - Used for conditional GET (`If-None-Match`)
 * @param props - App Router params promise for `[...path]`
 * @returns Binary response or an error status
 */
export async function GET(
  request: Request,
  props: { params: Promise<RouteParams> }
) {
  const authz = await requireAdminUploadApiSession();
  if (!authz.ok) {
    return authz.response;
  }

  const params = await props.params;
  const segments = params.path ?? [];
  const storageKey = pathSegmentsToStorageKey(segments);
  if (!storageKey) {
    return new NextResponse(null, { status: 400 });
  }

  const row = await prisma.upload.findUnique({
    where: { storageKey },
    select: { mimeType: true, sha256: true, scanStatus: true },
  });
  if (!row) {
    return new NextResponse(null, { status: 404 });
  }

  const clamEnabled = Boolean(Env.CLAMD_HOST);
  if (clamEnabled && row.scanStatus !== 'clean') {
    return new NextResponse(null, { status: 404 });
  }

  const baseDir = resolveUploadBaseDir();
  const basePrefix = `${path.resolve(baseDir)}${path.sep}`;
  const relativeFs = storageKey.split('/').join(path.sep);
  const absolutePath = path.resolve(path.join(baseDir, relativeFs));
  if (!absolutePath.startsWith(basePrefix)) {
    return new NextResponse(null, { status: 400 });
  }

  const etag = etagForSha256(row.sha256);
  if (ifNoneMatchApplies(request.headers.get('if-none-match'), etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'private, no-cache',
      },
    });
  }

  let data: Buffer;
  try {
    const st = await stat(absolutePath);
    if (!st.isFile()) {
      return new NextResponse(null, { status: 404 });
    }
    data = await readFile(absolutePath);
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': row.mimeType,
      'Content-Length': String(data.byteLength),
      ETag: etag,
      'Cache-Control': 'private, no-cache',
    },
  });
}
