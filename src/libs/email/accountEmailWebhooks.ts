import 'server-only';
import type { WebhookEventPayload } from 'resend';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/libs/DB';
import type { ResendWebhookContext } from '@/libs/email/emailMessages';
import { logger } from '@/libs/Logger';
import { normalizeEmail } from '@/libs/newsletter/newsletterValidation';

type EmailEventPayload = Extract<
  WebhookEventPayload,
  {
    data: {
      email_id: string;
      to: string[];
    };
  }
>;

function eventData(event: WebhookEventPayload): object | null {
  if (!('data' in event) || !event.data || typeof event.data !== 'object') {
    return null;
  }
  return event.data;
}

function isEmailEvent(event: WebhookEventPayload): event is EmailEventPayload {
  const data = eventData(event);
  return (
    event.type.startsWith('email.') &&
    data !== null &&
    'to' in data &&
    Array.isArray(data.to)
  );
}

function deliverabilityReason(event: EmailEventPayload): string | null {
  if (event.type === 'email.bounced') {
    return 'bounced';
  }
  if (event.type === 'email.complained') {
    return 'complained';
  }
  if (event.type === 'email.suppressed') {
    return 'suppressed';
  }
  return null;
}

function eventOccurredAt(event: EmailEventPayload): Date | null {
  const date = new Date(event.created_at);
  return Number.isNaN(date.getTime()) ? null : date;
}

function accountDeliverabilityUpdateWhere(params: {
  email: string;
  occurredAt: Date;
  reason: string;
}): Prisma.UserWhereInput {
  if (params.reason === 'bounced') {
    return {
      email: params.email,
      OR: [
        { emailBouncedAt: null },
        { emailBouncedAt: { lte: params.occurredAt } },
      ],
    };
  }

  return {
    email: params.email,
    OR: [
      { emailSuppressedAt: null },
      { emailSuppressedAt: { lte: params.occurredAt } },
    ],
  };
}

/**
 * Records account-email deliverability state from Resend webhooks.
 *
 * Newsletter delivery state is handled separately by newsletter webhooks; this
 * helper only stores compact account-level status for admin/user visibility.
 *
 * @param event - Verified Resend webhook payload
 * @param context - Verified webhook metadata from Svix headers
 */
export async function handleResendAccountEmailWebhook(
  event: WebhookEventPayload,
  context?: ResendWebhookContext
): Promise<void> {
  if (!isEmailEvent(event)) {
    return;
  }
  const reason = deliverabilityReason(event);
  const [recipient] = event.data.to;
  if (!reason || !recipient) {
    return;
  }

  const email = normalizeEmail(recipient);
  const occurredAt = eventOccurredAt(event);
  if (!occurredAt) {
    logger.warn('Skipping account email webhook with invalid timestamp', {
      email,
      timestamp: event.created_at,
      type: event.type,
    });
    return;
  }
  const client = context?.client ?? prisma;
  const update = await client.user.updateMany({
    data: {
      emailBouncedAt: reason === 'bounced' ? occurredAt : undefined,
      emailSuppressedAt: reason === 'bounced' ? undefined : occurredAt,
      emailSuppressionReason: reason === 'bounced' ? undefined : reason,
    },
    where: accountDeliverabilityUpdateWhere({
      email,
      occurredAt,
      reason,
    }),
  });
  logger.info('Processed account email deliverability webhook', {
    email,
    occurredAt: occurredAt.toISOString(),
    reason,
    updatedCount: update.count,
  });
}
