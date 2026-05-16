import 'server-only';
import type { WebhookEventPayload } from 'resend';
import type { Prisma } from '@/generated/prisma/client';
import type { NewsletterDeliveryStatus } from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';
import type {
  ResendWebhookClient,
  ResendWebhookContext,
} from '@/libs/email/emailMessages';
import {
  emailMessageIdForResendEvent,
  recordResendEmailMessageEvent,
} from '@/libs/email/emailMessages';
import {
  resendProviderEventIdForWebhook,
  resendWebhookOccurredAt,
} from '@/libs/email/resendWebhookEvents';
import { logger } from '@/libs/Logger';

type EmailEventPayload = Extract<
  WebhookEventPayload,
  {
    data: {
      email_id: string;
    };
  }
>;

type NewsletterWebhookClient = Pick<
  ResendWebhookClient,
  | '$queryRaw'
  | 'newsletterDelivery'
  | 'newsletterEvent'
  | 'newsletterSubscriber'
>;

const terminalDeliveryStatuses: NewsletterDeliveryStatus[] = [
  'delivered',
  'bounced',
  'complained',
  'failed',
  'suppressed',
  'cancelled',
] satisfies NewsletterDeliveryStatus[];

const failureDeliveryStatuses: NewsletterDeliveryStatus[] = [
  'bounced',
  'complained',
  'failed',
  'suppressed',
] satisfies NewsletterDeliveryStatus[];

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
  return failureDeliveryStatuses.includes(status);
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

function eventMetadata(params: {
  event: EmailEventPayload;
  providerEventId: string | null;
}) {
  return {
    providerEventId: params.providerEventId,
    resendEventCreatedAt: params.event.created_at,
    resendEventType: params.event.type,
    subject: params.event.data.subject,
  };
}

function isEmailEvent(event: WebhookEventPayload): event is EmailEventPayload {
  const data =
    'data' in event && event.data && typeof event.data === 'object'
      ? event.data
      : null;
  return (
    event.type.startsWith('email.') &&
    data !== null &&
    'email_id' in data &&
    typeof data.email_id === 'string' &&
    'to' in data &&
    Array.isArray(data.to)
  );
}

function emailEventTags(event: EmailEventPayload): unknown {
  return 'tags' in event.data ? event.data.tags : undefined;
}

function deliveryStatusUpdateConditions(params: {
  occurredAt: Date;
  status: NonNullable<ReturnType<typeof deliveryStatusForEmailEvent>>;
}): Prisma.NewsletterDeliveryWhereInput[] {
  if (isFailureStatus(params.status)) {
    return [
      { status: { notIn: terminalDeliveryStatuses } },
      {
        failedAt: { lte: params.occurredAt },
        status: { in: failureDeliveryStatuses },
      },
      { status: 'delivered', deliveredAt: { lte: params.occurredAt } },
      {
        deliveredAt: null,
        failedAt: null,
        status: { in: terminalDeliveryStatuses },
      },
    ];
  }

  if (params.status === 'delivered') {
    return [
      { status: { notIn: terminalDeliveryStatuses } },
      { status: 'delivered', deliveredAt: { lte: params.occurredAt } },
    ];
  }

  return [{ status: { notIn: terminalDeliveryStatuses } }];
}

async function findNewsletterDelivery(params: {
  tx: NewsletterWebhookClient;
  deliveryId: string;
  providerMessageId: string;
}) {
  const deliveryByProviderMessageId =
    await params.tx.newsletterDelivery.findFirst({
      include: { subscriber: true },
      where: { providerMessageId: params.providerMessageId },
    });

  if (deliveryByProviderMessageId || params.deliveryId.length === 0) {
    return deliveryByProviderMessageId;
  }

  const delivery = await params.tx.newsletterDelivery.findUnique({
    include: { subscriber: true },
    where: { id: params.deliveryId },
  });
  return delivery;
}

async function updateDeliveryStatus(params: {
  delivery: Awaited<ReturnType<typeof findNewsletterDelivery>>;
  occurredAt: Date;
  providerMessageId: string;
  status: ReturnType<typeof deliveryStatusForEmailEvent>;
  tx: NewsletterWebhookClient;
}): Promise<void> {
  if (!params.delivery || !params.status) {
    return;
  }

  const update = await params.tx.newsletterDelivery.updateMany({
    data: {
      deliveredAt:
        params.status === 'delivered' ? params.occurredAt : undefined,
      failedAt: isFailureStatus(params.status) ? params.occurredAt : undefined,
      providerMessageId: params.providerMessageId,
      sentAt: params.status === 'sent' ? params.occurredAt : undefined,
      status: params.status,
    },
    where: {
      id: params.delivery.id,
      OR: deliveryStatusUpdateConditions({
        occurredAt: params.occurredAt,
        status: params.status,
      }),
    },
  });
  if (update.count === 0) {
    logger.info('Skipped stale newsletter delivery webhook', {
      deliveryId: params.delivery.id,
      occurredAt: params.occurredAt.toISOString(),
      providerMessageId: params.providerMessageId,
      status: params.status,
    });
  }
}

async function suppressSubscriber(params: {
  delivery: Awaited<ReturnType<typeof findNewsletterDelivery>>;
  occurredAt: Date;
  tx: NewsletterWebhookClient;
  type: EmailEventPayload['type'];
}): Promise<void> {
  if (!params.delivery || !isSuppressingEvent(params.type)) {
    return;
  }

  const update = await params.tx.newsletterSubscriber.updateMany({
    data: {
      suppressedAt: params.occurredAt,
      suppressionReason: suppressionReason(params.type),
    },
    where: {
      id: params.delivery.subscriberId,
      OR: [
        { suppressedAt: null },
        { suppressedAt: { lte: params.occurredAt } },
      ],
    },
  });
  if (update.count === 0) {
    logger.info('Skipped stale newsletter subscriber suppression webhook', {
      occurredAt: params.occurredAt.toISOString(),
      subscriberId: params.delivery.subscriberId,
      type: params.type,
    });
  }
}

async function createNewsletterEvent(params: {
  delivery: Awaited<ReturnType<typeof findNewsletterDelivery>>;
  event: EmailEventPayload;
  occurredAt: Date;
  providerEventId: string;
  providerMessageId: string;
  tx: NewsletterWebhookClient;
  type: ReturnType<typeof eventTypeForEmailEvent>;
}): Promise<void> {
  if (!params.type) {
    return;
  }
  const existingEvent = await params.tx.newsletterEvent.findFirst({
    where: {
      createdAt: params.occurredAt,
      deliveryId: params.delivery?.id ?? null,
      providerMessageId: params.providerMessageId,
      type: params.type,
    },
  });
  if (existingEvent) {
    logger.info('Skipping duplicate newsletter event replay', {
      providerMessageId: params.providerMessageId,
      type: params.type,
    });
    return;
  }
  const [eventRecipient] = params.event.data.to;

  await params.tx.newsletterEvent.create({
    data: {
      broadcastId: params.delivery?.broadcastId ?? null,
      createdAt: params.occurredAt,
      deliveryId: params.delivery?.id ?? null,
      email: eventRecipient ?? params.delivery?.email ?? null,
      listId: params.delivery?.primaryListId ?? null,
      metadata: eventMetadata({
        event: params.event,
        providerEventId: params.providerEventId,
      }),
      providerMessageId: params.providerMessageId,
      subscriberId: params.delivery?.subscriberId ?? null,
      type: params.type,
    },
  });
}

async function runNewsletterWebhookTransaction(params: {
  context?: ResendWebhookContext;
  operation: (tx: NewsletterWebhookClient) => Promise<void>;
}) {
  if (params.context?.client) {
    await params.operation(params.context.client);
    return;
  }

  await prisma.$transaction(params.operation);
}

/**
 * Records Resend email delivery webhooks against newsletter deliveries.
 *
 * @param event - Verified Resend webhook payload
 * @param context - Verified webhook metadata from Svix headers
 */
export async function handleResendNewsletterWebhook(
  event: WebhookEventPayload,
  context?: ResendWebhookContext
): Promise<void> {
  if (!isEmailEvent(event)) {
    return;
  }

  const providerMessageId = event.data.email_id;
  const deliveryId = deliveryIdFromTags(emailEventTags(event));
  const status = deliveryStatusForEmailEvent(event.type);
  const type = eventTypeForEmailEvent(event.type);
  if (!status && !type) {
    return;
  }
  const occurredAt = resendWebhookOccurredAt(event);
  if (!occurredAt) {
    logger.warn('Skipping newsletter webhook with invalid timestamp', {
      providerMessageId,
      timestamp: event.created_at,
      type: event.type,
    });
    return;
  }
  const providerEventId = resendProviderEventIdForWebhook({
    event,
    occurredAt,
    providerEventId: context?.providerEventId,
    providerMessageId,
  });
  if (!providerEventId) {
    logger.warn('Skipping newsletter webhook without provider event id', {
      providerMessageId,
      timestamp: event.created_at,
      type: event.type,
    });
    return;
  }

  await runNewsletterWebhookTransaction({
    context,
    operation: async (tx) => {
      if (!context?.skipDedupe) {
        const emailMessageId = await emailMessageIdForResendEvent({
          client: tx,
          event,
          providerMessageId,
        });
        const isNewEvent = await recordResendEmailMessageEvent({
          client: tx,
          emailMessageId,
          event,
          occurredAt,
          providerEventId,
          providerMessageId,
        });
        if (!isNewEvent) {
          logger.info('Skipping duplicate newsletter webhook event', {
            providerEventId,
            providerMessageId,
            type: event.type,
          });
          return;
        }
      }

      const delivery = await findNewsletterDelivery({
        tx,
        deliveryId,
        providerMessageId,
      });
      await updateDeliveryStatus({
        delivery,
        occurredAt,
        providerMessageId,
        status,
        tx,
      });
      await suppressSubscriber({
        delivery,
        occurredAt,
        tx,
        type: event.type,
      });
      await createNewsletterEvent({
        delivery,
        event,
        occurredAt,
        providerEventId,
        providerMessageId,
        tx,
        type,
      });
    },
  });
}
