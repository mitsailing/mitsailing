import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/libs/DB';

type UploadAuditProps = {
  userId: string;
  action: string;
  status: string;
  severity: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
};

/**
 * Persists a CMS upload audit row without blocking the response path on failure.
 *
 * @param props - Actor, action, outcome, and optional request metadata
 */
export function logUploadAudit(props: UploadAuditProps): void {
  const data = {
    userId: props.userId,
    action: props.action,
    status: props.status,
    severity: props.severity,
    ipAddress: props.ipAddress,
    userAgent: props.userAgent,
    metadata: JSON.stringify(props.metadata),
  };
  setImmediate(() => {
    // Fire-and-forget: must not block the upload response path.
    // eslint-disable-next-line promise/prefer-await-to-then -- intentional detached persistence
    prisma.auditLog.create({ data }).catch(() => {
      /* ignore */
    });
  });
}

/**
 * Emits a Sentry breadcrumb-level signal for suspicious upload attempts.
 *
 * @param message - Short description
 * @param data - Structured context (no raw file bytes)
 */
export function captureUploadSecuritySignal(
  message: string,
  data: Record<string, unknown>
): void {
  Sentry.captureMessage(message, {
    level: 'warning',
    tags: { area: 'cms_upload' },
    extra: data,
  });
}
