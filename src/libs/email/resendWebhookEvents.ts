import type { WebhookEventPayload } from 'resend';

function resendWebhookEventId(event: WebhookEventPayload): string | null {
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

function resendEmailProviderEventId(event: WebhookEventPayload): string | null {
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

export function resendEmailProviderEventIdFromParts(params: {
  occurredAt: Date;
  providerMessageId: string;
  type: string;
}): string {
  return `${params.providerMessageId}:${params.type}:${params.occurredAt.toISOString()}`;
}

export function resendProviderEventIdForWebhook(params: {
  event: WebhookEventPayload;
  occurredAt?: Date | null;
  providerEventId?: string | null;
  providerMessageId?: string | null;
}): string | null {
  const explicitProviderEventId = params.providerEventId?.trim();
  if (explicitProviderEventId) {
    return explicitProviderEventId;
  }

  const webhookEventId = resendWebhookEventId(params.event);
  if (webhookEventId) {
    return webhookEventId;
  }

  const emailProviderEventId = resendEmailProviderEventId(params.event);
  if (emailProviderEventId) {
    return emailProviderEventId;
  }

  if (!params.event.type.startsWith('email.')) {
    return null;
  }

  const occurredAt = params.occurredAt ?? resendWebhookOccurredAt(params.event);
  const providerMessageId =
    params.providerMessageId ?? emailIdFromEvent(params.event);
  if (!occurredAt || !providerMessageId) {
    return null;
  }

  return resendEmailProviderEventIdFromParts({
    occurredAt,
    providerMessageId,
    type: params.event.type,
  });
}
