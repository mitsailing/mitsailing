import { NextResponse } from 'next/server';
import type { GateContext } from '@/libs/uploads/adminUploadPostGates';
import { scanBufferWithClamd } from '@/libs/uploads/clamdInstreamScan';
import type { ClamdScanResult } from '@/libs/uploads/clamdInstreamScan';
import {
  captureUploadSecuritySignal,
  logUploadAudit,
} from '@/libs/uploads/uploadAuditLog';

function responseForFailedClamdScan(
  ctx: GateContext,
  file: File,
  buf: Buffer,
  scanResult: Exclude<ClamdScanResult, { status: 'clean' }>
): NextResponse {
  if (scanResult.status === 'infected') {
    captureUploadSecuritySignal('CMS upload ClamAV match', {
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
      metadata: { reason: 'clamav_infected', mimeType: file.type },
    });
    return NextResponse.json(
      { error: 'File did not pass virus scan' },
      { status: 422 }
    );
  }

  logUploadAudit({
    userId: ctx.userId,
    action: 'cms_upload_post',
    status: 'error',
    severity: 'error',
    ipAddress: ctx.clientIp,
    userAgent: ctx.userAgent,
    metadata: {
      reason: 'clamav_unavailable',
      message: scanResult.message,
    },
  });
  return NextResponse.json(
    { error: 'Virus scan unavailable' },
    { status: 503 }
  );
}

/**
 * Runs ClamAV INSTREAM when `clamHost` is configured; returns an error
 * response when the upload must stop, or `null` to continue.
 *
 * @param ctx - Upload gate context (audit / actor)
 * @param file - Declared multipart file (metadata only)
 * @param buf - Bytes to scan
 * @param clamHost - `Env.CLAMD_HOST` when set
 * @param port - `Env.CLAMD_PORT`
 * @param timeoutMs - `Env.CLAMD_TIMEOUT_MS`
 * @returns `null` if ClamAV is off or the file is clean; otherwise a JSON error response
 */
export async function maybeClamdRejectUpload(
  ctx: GateContext,
  file: File,
  buf: Buffer,
  clamHost: string | undefined,
  port: number,
  timeoutMs: number
): Promise<NextResponse | null> {
  if (!clamHost) {
    return null;
  }

  const scanResult = await scanBufferWithClamd(buf, {
    host: clamHost,
    port,
    timeoutMs,
  });

  if (scanResult.status === 'clean') {
    return null;
  }

  return responseForFailedClamdScan(ctx, file, buf, scanResult);
}
