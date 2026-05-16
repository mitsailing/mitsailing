import type { WebhookEventPayload } from 'resend';

export function resendWebhookEventId(
  event: WebhookEventPayload
): string | null {
  return 'id' in event && typeof event.id === 'string' ? event.id : null;
}

export function resendWebhookOccurredAt(
  event: WebhookEventPayload
): Date | null {
  if (!('created_at' in event) || typeof event.created_at !== 'string') {
    return null;
  }

  const occurredAt = new Date(event.created_at);
  return Number.isNaN(occurredAt.getTime()) ? null : occurredAt;
}

function emailIdFromEvent(event: WebhookEventPayload): string | null {
  if (!('data' in event) || !event.data || typeof event.data !== 'object') {
    return null;
  }

  return 'email_id' in event.data && typeof event.data.email_id === 'string'
    ? event.data.email_id
    : null;
}

export function resendEmailProviderEventId(
  event: WebhookEventPayload
): string | null {
  if (!event.type.startsWith('email.')) {
    return null;
  }

  const emailId = emailIdFromEvent(event);
  const occurredAt = resendWebhookOccurredAt(event);
  if (!emailId || !occurredAt) {
    return null;
  }

  return `${emailId}:${event.type}:${occurredAt.toISOString()}`;
}
