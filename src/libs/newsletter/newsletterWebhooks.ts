import 'server-only';
import type { WebhookEventPayload } from 'resend';
import { prisma } from '@/libs/DB';

type EmailEventPayload = Extract<
  WebhookEventPayload,
  {
    data: {
      email_id: string;
    };
  }
>;

function deliveryIdFromTags(tags: unknown): string {
  if (!tags || typeof tags !== 'object' || Array.isArray(tags)) {
    return '';
  }
  const entry = Object.entries(tags).find(
    ([key]) => key === 'newsletter_delivery_id'
  );
  const value = entry?.[1];
  return typeof value === 'string' ? value : '';
}

function eventTypeForEmailEvent(type: EmailEventPayload['type']) {
  switch (type) {
    case 'email.delivered': {
      return 'delivered';
    }
    case 'email.delivery_delayed': {
      return 'delivery_delayed';
    }
    case 'email.bounced': {
      return 'bounced';
    }
    case 'email.complained': {
      return 'complained';
    }
    case 'email.failed': {
      return 'failed';
    }
    case 'email.suppressed': {
      return 'suppressed';
    }
    case 'email.sent':
    case 'email.scheduled':
    case 'email.opened':
    case 'email.clicked':
    case 'email.received': {
      return null;
    }
    default: {
      return null;
    }
  }
}

function deliveryStatusForEmailEvent(type: EmailEventPayload['type']) {
  switch (type) {
    case 'email.delivered': {
      return 'delivered';
    }
    case 'email.delivery_delayed': {
      return 'delivery_delayed';
    }
    case 'email.bounced': {
      return 'bounced';
    }
    case 'email.complained': {
      return 'complained';
    }
    case 'email.failed': {
      return 'failed';
    }
    case 'email.suppressed': {
      return 'suppressed';
    }
    case 'email.sent': {
      return 'sent';
    }
    case 'email.scheduled':
    case 'email.opened':
    case 'email.clicked':
    case 'email.received': {
      return null;
    }
    default: {
      return null;
    }
  }
}

function isFailureStatus(
  status: NonNullable<ReturnType<typeof deliveryStatusForEmailEvent>>
): boolean {
  return (
    status === 'bounced' ||
    status === 'complained' ||
    status === 'failed' ||
    status === 'suppressed'
  );
}

function isSuppressingEvent(type: EmailEventPayload['type']) {
  return (
    type === 'email.bounced' ||
    type === 'email.complained' ||
    type === 'email.suppressed'
  );
}

function suppressionReason(type: EmailEventPayload['type']) {
  if (type === 'email.bounced') {
    return 'bounced';
  }
  if (type === 'email.complained') {
    return 'complained';
  }
  return 'suppressed';
}

function eventMetadata(event: EmailEventPayload) {
  return {
    resendEventType: event.type,
    resendEventCreatedAt: event.created_at,
    subject: event.data.subject,
  };
}

function isEmailEvent(event: WebhookEventPayload): event is EmailEventPayload {
  return event.type.startsWith('email.');
}

function emailEventTags(event: EmailEventPayload): unknown {
  return 'tags' in event.data ? event.data.tags : undefined;
}

async function findNewsletterDelivery(params: {
  deliveryId: string;
  providerMessageId: string;
}) {
  const delivery = await prisma.newsletterDelivery.findFirst({
    include: { subscriber: true },
    where: {
      OR: [
        { providerMessageId: params.providerMessageId },
        ...(params.deliveryId.length > 0 ? [{ id: params.deliveryId }] : []),
      ],
    },
  });
  return delivery;
}

async function updateDeliveryStatus(params: {
  delivery: Awaited<ReturnType<typeof findNewsletterDelivery>>;
  providerMessageId: string;
  status: ReturnType<typeof deliveryStatusForEmailEvent>;
}): Promise<void> {
  if (!params.delivery || !params.status) {
    return;
  }

  await prisma.newsletterDelivery.update({
    data: {
      deliveredAt: params.status === 'delivered' ? new Date() : undefined,
      failedAt: isFailureStatus(params.status) ? new Date() : undefined,
      providerMessageId: params.providerMessageId,
      status: params.status,
    },
    where: { id: params.delivery.id },
  });
}

async function suppressSubscriber(params: {
  delivery: Awaited<ReturnType<typeof findNewsletterDelivery>>;
  type: EmailEventPayload['type'];
}): Promise<void> {
  if (!params.delivery || !isSuppressingEvent(params.type)) {
    return;
  }

  await prisma.newsletterSubscriber.update({
    data: {
      suppressedAt: new Date(),
      suppressionReason: suppressionReason(params.type),
    },
    where: { id: params.delivery.subscriberId },
  });
}

async function createNewsletterEvent(params: {
  delivery: Awaited<ReturnType<typeof findNewsletterDelivery>>;
  event: EmailEventPayload;
  providerMessageId: string;
  type: ReturnType<typeof eventTypeForEmailEvent>;
}): Promise<void> {
  if (!params.type) {
    return;
  }

  await prisma.newsletterEvent.create({
    data: {
      broadcastId: params.delivery?.broadcastId ?? null,
      deliveryId: params.delivery?.id ?? null,
      email: params.event.data.to[0] ?? params.delivery?.email ?? null,
      listId: params.delivery?.primaryListId ?? null,
      metadata: eventMetadata(params.event),
      providerMessageId: params.providerMessageId,
      subscriberId: params.delivery?.subscriberId ?? null,
      type: params.type,
    },
  });
}

/**
 * Records Resend email delivery webhooks against newsletter deliveries.
 *
 * @param event - Verified Resend webhook payload
 */
export async function handleResendNewsletterWebhook(
  event: WebhookEventPayload
): Promise<void> {
  if (!isEmailEvent(event)) {
    return;
  }

  const providerMessageId = event.data.email_id;
  const deliveryId = deliveryIdFromTags(emailEventTags(event));
  const delivery = await findNewsletterDelivery({
    deliveryId,
    providerMessageId,
  });
  const status = deliveryStatusForEmailEvent(event.type);
  const type = eventTypeForEmailEvent(event.type);

  await updateDeliveryStatus({ delivery, providerMessageId, status });
  await suppressSubscriber({ delivery, type: event.type });
  await createNewsletterEvent({ delivery, event, providerMessageId, type });
}
