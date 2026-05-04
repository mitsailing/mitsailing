import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/libs/DB';
import { adminUploadPostArcjet } from '@/libs/uploads/adminUploadArcjet';
import { normalizeUploadIdempotencyKey } from '@/libs/uploads/normalizeUploadIdempotencyKey';
import { parseClientIp } from '@/libs/uploads/parseClientIp';
import { logUploadAudit } from '@/libs/uploads/uploadAuditLog';
import { inMemoryUploadPostRateLimit } from '@/libs/uploads/uploadInMemoryRateLimit';

export type GateContext = {
  userId: string;
  clientIp: string | null;
  userAgent: string | null;
  idempotencyKey: string | null;
};

/**
 * Runs Arcjet when configured; returns a deny response or null when allowed.
 *
 * @param request - Incoming upload POST
 * @param ctx - Actor and request metadata for audit rows
 * @returns Rate-limit or forbidden response, or null when the request may proceed
 */
export async function denyIfArcjetUploadPostBlocked(
  request: NextRequest,
  ctx: GateContext
): Promise<NextResponse | null> {
  const arcjetClient = adminUploadPostArcjet;
  if (!arcjetClient) {
    return null;
  }
  const decision = await arcjetClient.protect(request, {
    userId: ctx.userId,
  });
  if (!decision.isDenied()) {
    return null;
  }
  logUploadAudit({
    userId: ctx.userId,
    action: 'cms_upload_post',
    status: 'denied',
    severity: 'warning',
    ipAddress: ctx.clientIp,
    userAgent: ctx.userAgent,
    metadata: {
      gate: 'arcjet',
      rateLimited: decision.reason.isRateLimit(),
    },
  });
  if (decision.reason.isRateLimit()) {
    const retryAfter = String(decision.reason.reset);
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': retryAfter },
      }
    );
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * Returns an idempotent replay response when a prior upload used the same key.
 *
 * @param ctx - Actor, headers-derived metadata, and normalized idempotency key
 * @returns JSON replay response or null when no prior row exists
 */
export async function maybeIdempotentUploadReplay(
  ctx: GateContext
): Promise<NextResponse | null> {
  if (!ctx.idempotencyKey) {
    return null;
  }
  const existing = await prisma.upload.findUnique({
    where: {
      uploadedById_idempotencyKey: {
        uploadedById: ctx.userId,
        idempotencyKey: ctx.idempotencyKey,
      },
    },
    select: { storageKey: true },
  });
  if (!existing) {
    return null;
  }
  logUploadAudit({
    userId: ctx.userId,
    action: 'cms_upload_idempotent_replay',
    status: 'success',
    severity: 'info',
    ipAddress: ctx.clientIp,
    userAgent: ctx.userAgent,
    metadata: { storageKey: existing.storageKey },
  });
  return NextResponse.json({ url: `/api/uploads/${existing.storageKey}` });
}

/**
 * In-process sliding-window cap per admin (tighter when Arcjet is off).
 *
 * @param ctx - Actor and request metadata for audit rows
 * @param arcjetActive - Whether Arcjet already contributes a cloud rate limit
 * @returns Rate-limit response or null when the request may proceed
 */
export function denyIfInMemoryUploadPostBlocked(
  ctx: GateContext,
  arcjetActive: boolean
): NextResponse | null {
  const mem = inMemoryUploadPostRateLimit(ctx.userId, arcjetActive);
  if (mem.allowed) {
    return null;
  }
  logUploadAudit({
    userId: ctx.userId,
    action: 'cms_upload_post',
    status: 'denied',
    severity: 'warning',
    ipAddress: ctx.clientIp,
    userAgent: ctx.userAgent,
    metadata: { gate: 'in_memory', retryAfterSec: mem.retryAfterSec },
  });
  return NextResponse.json(
    { error: 'Too many requests' },
    {
      status: 429,
      headers: { 'Retry-After': String(mem.retryAfterSec) },
    }
  );
}

/**
 * Shared request context for upload POST gates and core handler.
 *
 * @param request - Incoming multipart request
 * @param userId - Authenticated admin id
 * @returns Gate context including normalized idempotency key
 */
export function buildUploadPostGateContext(
  request: NextRequest,
  userId: string
): GateContext {
  const { headers } = request;
  return {
    userId,
    clientIp: parseClientIp(headers),
    userAgent: headers.get('user-agent'),
    idempotencyKey: normalizeUploadIdempotencyKey(
      headers.get('idempotency-key')
    ),
  };
}
