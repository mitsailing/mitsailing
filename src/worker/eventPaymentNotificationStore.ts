import { randomUUID } from 'node:crypto';
import { EventPaymentNotificationKind } from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';

const notificationClaimPrefix = 'claim:';
const notificationClaimTtlMs = 15 * 60 * 1000;

export type PaymentNotificationKind =
  | 'admin_digest'
  | 'receipt'
  | 'reminder'
  | 'request';

type NotificationMarker = { claimId: string; id: string };
type CleanupFailure = { error: unknown; marker: NotificationMarker };

export function notificationKindForJob(
  kind: 'receipt' | 'reminder' | 'request'
): PaymentNotificationKind {
  if (kind === 'receipt') {
    return EventPaymentNotificationKind.receipt;
  }
  if (kind === 'reminder') {
    return EventPaymentNotificationKind.reminder;
  }
  return EventPaymentNotificationKind.request;
}

export async function ensureNotificationMarker(options: {
  dateKey: string;
  kind: PaymentNotificationKind;
  paymentId: string;
}): Promise<{ claimId: string; id: string } | null> {
  const claimId = `${notificationClaimPrefix}${randomUUID()}`;
  const marker = await prisma.eventPaymentNotification.upsert({
    create: {
      kind: options.kind,
      paymentId: options.paymentId,
      sentDateKey: options.dateKey,
    },
    update: {},
    where: {
      paymentId_kind_sentDateKey: {
        kind: options.kind,
        paymentId: options.paymentId,
        sentDateKey: options.dateKey,
      },
    },
  });
  if (
    marker.providerMessageId &&
    !marker.providerMessageId.startsWith(notificationClaimPrefix)
  ) {
    return null;
  }

  const staleClaimBefore = new Date(Date.now() - notificationClaimTtlMs);
  const claim = await prisma.eventPaymentNotification.updateMany({
    data: { providerMessageId: claimId },
    where: {
      id: marker.id,
      OR: [
        { providerMessageId: null },
        {
          providerMessageId: { startsWith: notificationClaimPrefix },
          updatedAt: { lt: staleClaimBefore },
        },
      ],
    },
  });
  if (claim.count === 0) {
    return null;
  }
  return { claimId, id: marker.id };
}

export async function clearNotificationClaim(options: {
  claimId: string;
  notificationId: string;
}): Promise<void> {
  await prisma.eventPaymentNotification.updateMany({
    data: { providerMessageId: null },
    where: {
      id: options.notificationId,
      providerMessageId: options.claimId,
    },
  });
}

export async function recordProviderMessageId(options: {
  claimId: string;
  notificationId: string;
  providerMessageId: string | null;
}): Promise<void> {
  await prisma.eventPaymentNotification.updateMany({
    data: {
      providerMessageId:
        options.providerMessageId ?? `sent-without-provider:${options.claimId}`,
    },
    where: {
      id: options.notificationId,
      providerMessageId: options.claimId,
    },
  });
}

function isCleanupFailure(
  result: CleanupFailure | null
): result is CleanupFailure {
  return result !== null;
}

async function clearNotificationMarker(
  marker: NotificationMarker
): Promise<CleanupFailure | null> {
  try {
    await clearNotificationClaim({
      claimId: marker.claimId,
      notificationId: marker.id,
    });
    return null;
  } catch (error) {
    return { error, marker };
  }
}

export async function clearNotificationClaims(
  markers: readonly { claimId: string; id: string }[]
): Promise<void> {
  const cleanupFailures = await Promise.all(
    markers.map(clearNotificationMarker)
  );
  for (const cleanupFailure of cleanupFailures.filter(isCleanupFailure)) {
    logger.error(
      '[event-payment-email] admin_digest cleanup_failed notification_id={notificationId} error_name={errorName} error_code={errorCode}',
      {
        errorCode: safeErrorCode(cleanupFailure.error) ?? 'unknown',
        errorName: safeErrorName(cleanupFailure.error),
        notificationId: cleanupFailure.marker.id,
      }
    );
  }
}
