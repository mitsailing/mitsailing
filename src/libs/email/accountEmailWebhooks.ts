import 'server-only';
import type { WebhookEventPayload } from 'resend';
import { prisma } from '@/libs/DB';
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

/**
 * Records account-email deliverability state from Resend webhooks.
 *
 * Newsletter delivery state is handled separately by newsletter webhooks; this
 * helper only stores compact account-level status for admin/user visibility.
 *
 * @param event - Verified Resend webhook payload
 */
export async function handleResendAccountEmailWebhook(
  event: WebhookEventPayload
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
  const now = new Date();
  await prisma.user.updateMany({
    data: {
      emailBouncedAt: reason === 'bounced' ? now : undefined,
      emailSuppressedAt: now,
      emailSuppressionReason: reason,
    },
    where: { email },
  });
}
