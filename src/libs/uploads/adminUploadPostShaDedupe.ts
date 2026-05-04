import { stat } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { prisma } from '@/libs/DB';
import type { GateContext } from '@/libs/uploads/adminUploadPostGates';
import { resolveUploadBaseDir } from '@/libs/uploads/resolveUploadBaseDir';
import { logUploadAudit } from '@/libs/uploads/uploadAuditLog';

/**
 * If an identical upload exists on disk for this user, returns the JSON URL
 * response and optionally bumps `scan_status` to `clean` when ClamAV is on.
 *
 * @param ctx - Authenticated actor context
 * @param sha256 - SHA-256 of the incoming buffer
 * @param byteSize - Byte length of the buffer
 * @param clamHost - When set, legacy `not_scanned` rows are upgraded to `clean`
 * @returns Response when dedupe applies; otherwise `null`
 */
export async function maybeRespondWithSha256Dedupe(
  ctx: GateContext,
  sha256: string,
  byteSize: number,
  clamHost: string | undefined
): Promise<NextResponse | null> {
  const priorSameBytes = await prisma.upload.findFirst({
    where: {
      uploadedById: ctx.userId,
      sha256,
      byteSize,
    },
    orderBy: { createdAt: 'desc' },
    select: { storageKey: true, scanStatus: true },
  });

  if (!priorSameBytes) {
    return null;
  }

  const baseDir = resolveUploadBaseDir();
  const basePrefix = `${path.resolve(baseDir)}${path.sep}`;
  const relativeFs = priorSameBytes.storageKey.split('/').join(path.sep);
  const absolutePath = path.resolve(path.join(baseDir, relativeFs));

  if (!absolutePath.startsWith(basePrefix)) {
    return null;
  }

  try {
    const st = await stat(absolutePath);
    if (!st.isFile()) {
      return null;
    }
  } catch {
    return null;
  }

  if (clamHost && priorSameBytes.scanStatus !== 'clean') {
    await prisma.upload.update({
      where: { storageKey: priorSameBytes.storageKey },
      data: { scanStatus: 'clean' },
    });
  }

  logUploadAudit({
    userId: ctx.userId,
    action: 'cms_upload_sha256_dedupe',
    status: 'success',
    severity: 'info',
    ipAddress: ctx.clientIp,
    userAgent: ctx.userAgent,
    metadata: {
      storageKey: priorSameBytes.storageKey,
      byteSize,
    },
  });

  return NextResponse.json({
    url: `/api/uploads/${priorSameBytes.storageKey}`,
  });
}
