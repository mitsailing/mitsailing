import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { adminUploadPostArcjet } from '@/libs/uploads/adminUploadArcjet';
import { decodeAdminUploadListCursor } from '@/libs/uploads/adminUploadListCursor';
import {
  parseUploadListLimitParam,
  queryAdminUploadImageListPage,
} from '@/libs/uploads/adminUploadListGet';
import { runAdminUploadPostCore } from '@/libs/uploads/adminUploadPostCore';
import {
  buildUploadPostGateContext,
  denyIfArcjetUploadPostBlocked,
  denyIfInMemoryUploadPostBlocked,
  maybeIdempotentUploadReplay,
} from '@/libs/uploads/adminUploadPostGates';
import { requireAdminUploadApiSession } from '@/libs/uploads/requireAdminUploadApiSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lists previously uploaded images for the media library picker (cursor-paginated).
 * Auditing each list request is intentionally omitted — noisy for normal editing.
 *
 * @param request - Query: `limit`, optional `cursor`
 * @returns JSON `{ items, nextCursor }` or error
 */
export async function GET(request: NextRequest) {
  const authz = await requireAdminUploadApiSession();
  if (!authz.ok) {
    return authz.response;
  }

  const { searchParams } = new URL(request.url);
  const limit = parseUploadListLimitParam(searchParams.get('limit'));

  const cursorRaw = searchParams.get('cursor');
  const cursor =
    cursorRaw !== null && cursorRaw !== ''
      ? decodeAdminUploadListCursor(cursorRaw)
      : null;
  if (cursorRaw !== null && cursorRaw !== '' && cursor === null) {
    return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
  }

  const body = await queryAdminUploadImageListPage(limit, cursor);
  return NextResponse.json(body);
}

/**
 * Accepts a multipart `file` from admins, writes under the configured upload
 * root (`UPLOAD_DIR`), persists metadata, and returns a session-gated URL
 * for rich text embeds.
 *
 * @param request - Multipart request with `file` field
 * @returns JSON with `url` or an error payload
 */
export async function POST(request: NextRequest) {
  const authz = await requireAdminUploadApiSession();
  if (!authz.ok) {
    return authz.response;
  }

  const gateCtx = buildUploadPostGateContext(request, authz.userId);

  const arcjetDenied = await denyIfArcjetUploadPostBlocked(request, gateCtx);
  if (arcjetDenied) {
    return arcjetDenied;
  }

  const idempotent = await maybeIdempotentUploadReplay(gateCtx);
  if (idempotent) {
    return idempotent;
  }

  const memDenied = denyIfInMemoryUploadPostBlocked(
    gateCtx,
    Boolean(adminUploadPostArcjet)
  );
  if (memDenied) {
    return memDenied;
  }

  return runAdminUploadPostCore(request, gateCtx);
}
