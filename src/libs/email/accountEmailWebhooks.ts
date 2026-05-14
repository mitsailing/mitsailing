import 'server-only';
import type { WebhookEventPayload } from 'resend';
import { prisma } from '@/libs/DB';
import type { ResendWebhookContext } from '@/libs/email/emailMessages';
import { normalizeNewsletterEmail } from '@/libs/newsletter/newsletterValidation';

type EmailEventPayload = Extract<
  WebhookEventPayload,
  {
    data: {
      email_id: string;
      to: string[];
    };
  }
>;

function isEmailEvent(event: WebhookEventPayload): event is EmailEventPayload {
  return event.type.startsWith('email.');
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

function eventOccurredAt(event: EmailEventPayload): Date {
  return new Date(event.created_at);
}

/**
 * Records account-email deliverability state from Resend webhooks.
 *
 * Newsletter delivery state is handled separately by newsletter webhooks; this
 * helper only stores compact account-level status for admin/user visibility.
 *
 * @param event - Verified Resend webhook payload
 * @param _context - Verified webhook metadata from Svix headers
 */
export async function handleResendAccountEmailWebhook(
  event: WebhookEventPayload,
  _context?: ResendWebhookContext
): Promise<void> {
  if (!isEmailEvent(event)) {
    return;
  }
  const reason = deliverabilityReason(event);
  const [recipient] = event.data.to;
  if (!reason || !recipient) {
    return;
  }

  const email = normalizeNewsletterEmail(recipient);
  const occurredAt = eventOccurredAt(event);
  await prisma.user.updateMany({
    data: {
      emailBouncedAt: reason === 'bounced' ? occurredAt : undefined,
      emailSuppressedAt: occurredAt,
      emailSuppressionReason: reason,
    },
    where: {
      email,
      OR: [
        { emailSuppressedAt: null },
        { emailSuppressedAt: { lte: occurredAt } },
      ],
    },
  });
}
