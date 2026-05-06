import { createHash, randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { maybeClamdRejectUpload } from '@/libs/uploads/adminUploadPostClamGate';
import type { GateContext } from '@/libs/uploads/adminUploadPostGates';
import { maybeRespondWithSha256Dedupe } from '@/libs/uploads/adminUploadPostShaDedupe';
import { MIME_TO_EXT } from '@/libs/uploads/allowedMime';
import { declaredMimeMatchesMagicBytes } from '@/libs/uploads/magicBytes';
import { MAX_UPLOAD_BYTES } from '@/libs/uploads/maxUploadBytes';
import { resolveUploadBaseDir } from '@/libs/uploads/resolveUploadBaseDir';
import { buildStorageKey } from '@/libs/uploads/storageKey';
import {
  captureUploadSecuritySignal,
  logUploadAudit,
} from '@/libs/uploads/uploadAuditLog';

/**
 * Parses multipart body, validates, optionally dedupes by SHA-256, writes disk,
 * and creates an `Upload` row.
 *
 * @param request - Multipart request (body not yet consumed)
 * @param ctx - Authenticated actor and idempotency key
 * @returns JSON success or error response
 */
export async function runAdminUploadPostCore(
  request: NextRequest,
  ctx: GateContext
): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') ?? formData.get('upload');
    if (!(file instanceof File)) {
      logUploadAudit({
        userId: ctx.userId,
        action: 'cms_upload_post',
        status: 'rejected',
        severity: 'info',
        ipAddress: ctx.clientIp,
        userAgent: ctx.userAgent,
        metadata: { reason: 'missing_file' },
      });
      return NextResponse.json(
        { error: { message: 'Expected upload file' } },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      logUploadAudit({
        userId: ctx.userId,
        action: 'cms_upload_post',
        status: 'rejected',
        severity: 'info',
        ipAddress: ctx.clientIp,
        userAgent: ctx.userAgent,
        metadata: { reason: 'file_too_large', byteSize: file.size },
      });
      return NextResponse.json(
        { error: { message: 'File too large' } },
        { status: 413 }
      );
    }

    const ext = MIME_TO_EXT[file.type];
    if (!ext) {
      logUploadAudit({
        userId: ctx.userId,
        action: 'cms_upload_post',
        status: 'rejected',
        severity: 'info',
        ipAddress: ctx.clientIp,
        userAgent: ctx.userAgent,
        metadata: { reason: 'unsupported_mime', mimeType: file.type },
      });
      return NextResponse.json(
        { error: { message: 'Unsupported type' } },
        { status: 415 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash('sha256').update(buf).digest('hex');

    if (
      Env.NODE_ENV === 'production' &&
      !declaredMimeMatchesMagicBytes(file.type, buf)
    ) {
      captureUploadSecuritySignal('CMS upload magic bytes mismatch', {
        userId: ctx.userId,
        mimeType: file.type,
        byteSize: buf.byteLength,
      });
      logUploadAudit({
        userId: ctx.userId,
        action: 'cms_upload_post',
        status: 'rejected',
        severity: 'warning',
        ipAddress: ctx.clientIp,
        userAgent: ctx.userAgent,
        metadata: { reason: 'magic_bytes_mismatch', mimeType: file.type },
      });
      return NextResponse.json(
        { error: { message: 'Content does not match declared type' } },
        { status: 415 }
      );
    }

    const clamHost = Env.CLAMD_HOST;
    const clamRejected = await maybeClamdRejectUpload(
      ctx,
      file,
      buf,
      clamHost,
      Env.CLAMD_PORT,
      Env.CLAMD_TIMEOUT_MS
    );
    if (clamRejected) {
      return clamRejected;
    }

    const deduped = await maybeRespondWithSha256Dedupe(
      ctx,
      sha256,
      buf.byteLength,
      clamHost
    );
    if (deduped) {
      return deduped;
    }

    const baseDir = resolveUploadBaseDir();
    const basePrefix = `${path.resolve(baseDir)}${path.sep}`;

    const now = new Date();
    const id = randomUUID();
    const storageKey = buildStorageKey(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      id,
      ext
    );

    const relativeFs = storageKey.split('/').join(path.sep);
    const dest = path.join(baseDir, relativeFs);
    const resolvedDest = path.resolve(dest);
    if (!resolvedDest.startsWith(basePrefix)) {
      return NextResponse.json(
        { error: { message: 'Invalid path' } },
        { status: 400 }
      );
    }

    await mkdir(path.dirname(resolvedDest), { recursive: true });
    await writeFile(resolvedDest, buf);

    try {
      await prisma.upload.create({
        data: {
          storageKey,
          mimeType: file.type,
          byteSize: buf.byteLength,
          sha256,
          uploadedById: ctx.userId,
          idempotencyKey: ctx.idempotencyKey ?? undefined,
          scanStatus: clamHost ? 'clean' : undefined,
        },
      });
    } catch (error) {
      try {
        await unlink(resolvedDest);
      } catch {
        /* ignore missing or locked file */
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        ctx.idempotencyKey
      ) {
        const row = await prisma.upload.findUnique({
          where: {
            uploadedById_idempotencyKey: {
              uploadedById: ctx.userId,
              idempotencyKey: ctx.idempotencyKey,
            },
          },
          select: { storageKey: true },
        });
        if (row) {
          logUploadAudit({
            userId: ctx.userId,
            action: 'cms_upload_idempotent_replay',
            status: 'success',
            severity: 'info',
            ipAddress: ctx.clientIp,
            userAgent: ctx.userAgent,
            metadata: {
              storageKey: row.storageKey,
              note: 'race_on_create',
            },
          });
          return NextResponse.json({ url: `/api/uploads/${row.storageKey}` });
        }
      }
      throw error;
    }

    logUploadAudit({
      userId: ctx.userId,
      action: 'cms_upload_post',
      status: 'success',
      severity: 'info',
      ipAddress: ctx.clientIp,
      userAgent: ctx.userAgent,
      metadata: {
        storageKey,
        byteSize: buf.byteLength,
        mimeType: file.type,
        idempotent: Boolean(ctx.idempotencyKey),
      },
    });
    return NextResponse.json({ url: `/api/uploads/${storageKey}` });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected exception';
    logUploadAudit({
      userId: ctx.userId,
      action: 'cms_upload_post',
      status: 'error',
      severity: 'error',
      ipAddress: ctx.clientIp,
      userAgent: ctx.userAgent,
      metadata: { message },
    });
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
