import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { requestNewsletterArchiveRevalidation } from '@/libs/newsletter/newsletterArchiveCache';
import {
  renderNewsletterBroadcastEmail,
  sendNewsletterBroadcastEmail,
} from '@/libs/newsletter/newsletterEmail';
import { enqueueNewsletterBroadcast } from '@/libs/newsletter/newsletterQueue';
import { getBaseUrl } from '@/utils/Helpers';

const NEWSLETTER_DELIVERY_BATCH_SIZE = 50;
const NEWSLETTER_CONTINUATION_DELAY_MS = 1000;
const NEWSLETTER_DELIVERY_MAX_ATTEMPTS = 3;

type CreateBroadcastParams = {
  body: string;
  createdByUserId: string;
  listIds: readonly string[];
  name: string | null;
  previewText: string;
  queueForSending: boolean;
  scheduledAt?: Date | null;
  subject: string;
  templateId: string;
};

export type CreateNewsletterBroadcastResult =
  | { ok: true; broadcastId: string; queued: boolean }
  | {
      ok: false;
      error:
        | 'enqueue_failed'
        | 'invalid_lists'
        | 'invalid_template'
        | 'no_recipients'
        | 'redis_unavailable';
    };

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function futureScheduledAt(params: CreateBroadcastParams): Date | null {
  if (!params.queueForSending || !params.scheduledAt) {
    return null;
  }

  return params.scheduledAt.getTime() > Date.now() ? params.scheduledAt : null;
}

function retryableDeliveryWhere(
  broadcastId: string
): Prisma.NewsletterDeliveryWhereInput {
  return {
    attemptCount: { lt: NEWSLETTER_DELIVERY_MAX_ATTEMPTS },
    broadcastId,
    status: { in: ['failed', 'queued'] },
  };
}

/**
 * Lists admin broadcast rows with aggregate delivery counts.
 *
 * @returns Broadcast rows ordered newest first
 */
export async function getAdminNewsletterBroadcasts() {
  const broadcasts = await prisma.newsletterBroadcast.findMany({
    include: {
      _count: { select: { deliveries: true } },
      primaryList: true,
      targetLists: { include: { list: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return broadcasts;
}

/**
 * Loads one admin broadcast with related delivery and audit rows.
 *
 * @param broadcastId - Broadcast id
 * @returns Broadcast detail row or null
 */
export async function getAdminNewsletterBroadcastDetail(broadcastId: string) {
  const [broadcast, deliveryStatusCounts] = await Promise.all([
    prisma.newsletterBroadcast.findUnique({
      include: {
        _count: { select: { deliveries: true } },
        createdBy: { select: { email: true, name: true } },
        deliveries: {
          orderBy: { updatedAt: 'desc' },
          select: {
            attemptCount: true,
            deliveredAt: true,
            email: true,
            failedAt: true,
            id: true,
            lastError: true,
            sentAt: true,
            status: true,
            updatedAt: true,
          },
          take: 25,
        },
        primaryList: true,
        targetLists: {
          include: { list: true },
          orderBy: { list: { displayOrder: 'asc' } },
        },
        template: true,
      },
      where: { id: broadcastId },
    }),
    prisma.newsletterDelivery.groupBy({
      _count: { _all: true },
      by: ['status'],
      orderBy: { status: 'asc' },
      where: { broadcastId },
    }),
  ]);

  if (!broadcast) {
    return null;
  }

  return { broadcast, deliveryStatusCounts };
}

/**
 * Renders the admin preview HTML for a saved broadcast.
 *
 * @param broadcast - Broadcast content and primary list
 * @returns Rendered HTML email preview
 */
export async function renderAdminNewsletterBroadcastPreviewHtml(broadcast: {
  body: string;
  previewText: string;
  primaryList: { name: string };
  subject: string;
}) {
  const newsletterUrl = `${getBaseUrl().replace(/\/$/, '')}/newsletter`;
  const rendered = await renderNewsletterBroadcastEmail({
    body: broadcast.body,
    listName: broadcast.primaryList.name,
    manageUrl: newsletterUrl,
    postalAddress: Env.NEWSLETTER_POSTAL_ADDRESS,
    previewText: broadcast.previewText,
    subject: broadcast.subject,
    unsubscribeUrl: newsletterUrl,
  });
  return rendered.html;
}

/**
 * Lists admin subscribers with subscriptions.
 *
 * @returns Subscriber rows ordered newest first
 */
export async function getAdminNewsletterSubscribers() {
  const subscribers = await prisma.newsletterSubscriber.findMany({
    include: {
      subscriptions: {
        include: { list: true },
        orderBy: { list: { displayOrder: 'asc' } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return subscribers;
}

/**
 * Lists admin newsletter lists.
 *
 * @returns Newsletter list rows ordered for display
 */
export async function getAdminNewsletterLists() {
  const lists = await prisma.newsletterList.findMany({
    include: { _count: { select: { subscriptions: true } } },
    orderBy: { displayOrder: 'asc' },
  });
  return lists;
}

/**
 * Lists newsletter templates.
 *
 * @returns Template rows ordered by default first
 */
export async function getAdminNewsletterTemplates() {
  const templates = await prisma.newsletterTemplate.findMany({
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  return templates;
}

async function markNewsletterBroadcastEnqueueFailed(params: {
  broadcastId: string;
  error: 'enqueue_failed' | 'redis_unavailable';
}) {
  const failedAt = new Date();
  await prisma.$transaction([
    prisma.newsletterBroadcast.update({
      data: {
        queuedAt: null,
        status: 'failed',
      },
      where: { id: params.broadcastId },
    }),
    prisma.newsletterDelivery.updateMany({
      data: {
        failedAt,
        lastError: params.error,
        status: 'failed',
      },
      where: {
        broadcastId: params.broadcastId,
        status: { in: ['queued', 'sending'] },
      },
    }),
  ]);
}

/**
 * Creates a broadcast and, when requested, materializes per-subscriber deliveries.
 *
 * @param params - Broadcast form data
 * @returns Created broadcast id or validation error
 */
export async function createNewsletterBroadcast(
  params: CreateBroadcastParams
): Promise<CreateNewsletterBroadcastResult> {
  const scheduledAt = futureScheduledAt(params);
  const listIds = uniqueStrings(params.listIds);
  const lists = await prisma.newsletterList.findMany({
    orderBy: { displayOrder: 'asc' },
    where: { id: { in: listIds }, isArchived: false },
  });
  if (lists.length !== listIds.length || lists.length === 0) {
    return { ok: false, error: 'invalid_lists' };
  }

  const template = await prisma.newsletterTemplate.findUnique({
    select: { id: true },
    where: { id: params.templateId },
  });
  if (!template) {
    return { ok: false, error: 'invalid_template' };
  }

  const recipients = params.queueForSending
    ? await prisma.newsletterSubscription.findMany({
        include: { subscriber: true },
        orderBy: [
          { subscriber: { email: 'asc' } },
          { list: { displayOrder: 'asc' } },
        ],
        where: {
          listId: { in: lists.map((list) => list.id) },
          status: 'subscribed',
          subscriber: {
            globalUnsubscribedAt: null,
            OR: [{ userId: null }, { user: { emailVerified: true } }],
            suppressedAt: null,
          },
        },
      })
    : [];

  const recipientBySubscriberId = new Map<
    string,
    {
      listId: string;
      subscriber: (typeof recipients)[number]['subscriber'];
    }
  >();
  for (const subscription of recipients) {
    if (!recipientBySubscriberId.has(subscription.subscriber.id)) {
      recipientBySubscriberId.set(subscription.subscriber.id, {
        listId: subscription.listId,
        subscriber: subscription.subscriber,
      });
    }
  }
  if (params.queueForSending && recipientBySubscriberId.size === 0) {
    return { ok: false, error: 'no_recipients' };
  }

  const [primaryList] = lists;
  if (!primaryList) {
    return { ok: false, error: 'invalid_lists' };
  }

  const broadcast = await prisma.$transaction(async (tx) => {
    const deliveryQueuedAt = new Date();
    const queuedAt = params.queueForSending ? deliveryQueuedAt : null;
    const created = await tx.newsletterBroadcast.create({
      data: {
        body: params.body,
        createdByUserId: params.createdByUserId,
        name: params.name,
        previewText: params.previewText,
        primaryListId: primaryList.id,
        queuedAt,
        scheduledAt,
        status: params.queueForSending ? 'queued' : 'draft',
        subject: params.subject,
        templateId: params.templateId,
        targetLists: {
          createMany: {
            data: lists.map((list) => ({ listId: list.id })),
          },
        },
      },
    });
    await tx.newsletterEvent.create({
      data: {
        actorUserId: params.createdByUserId,
        broadcastId: created.id,
        type: 'broadcast_created',
      },
    });

    if (params.queueForSending) {
      await tx.newsletterDelivery.createMany({
        data: [...recipientBySubscriberId.values()].map((recipient) => ({
          broadcastId: created.id,
          email: recipient.subscriber.email,
          primaryListId: recipient.listId,
          queuedAt: deliveryQueuedAt,
          subscriberId: recipient.subscriber.id,
        })),
      });
    }

    return created;
  });

  if (params.queueForSending) {
    const enqueueResult = await enqueueNewsletterBroadcast({
      broadcastId: broadcast.id,
      scheduledAt,
    });
    if (!enqueueResult.ok) {
      await markNewsletterBroadcastEnqueueFailed({
        broadcastId: broadcast.id,
        error: enqueueResult.error,
      });
      return { ok: false, error: enqueueResult.error };
    }

    await prisma.newsletterEvent.create({
      data: {
        actorUserId: params.createdByUserId,
        broadcastId: broadcast.id,
        type: 'broadcast_queued',
      },
    });
  }

  return {
    ok: true,
    broadcastId: broadcast.id,
    queued: params.queueForSending,
  };
}

async function cancelQueuedNewsletterDeliveries(broadcastId: string) {
  await prisma.newsletterDelivery.updateMany({
    data: { status: 'cancelled' },
    where: {
      broadcastId,
      status: { in: ['queued', 'sending'] },
    },
  });
}

async function findNewsletterBroadcast(broadcastId: string) {
  const broadcast = await prisma.newsletterBroadcast.findUnique({
    where: { id: broadcastId },
  });
  return broadcast;
}

type NewsletterBroadcastRow = NonNullable<
  Awaited<ReturnType<typeof findNewsletterBroadcast>>
>;

async function stopInactiveNewsletterBroadcast(
  broadcast: NewsletterBroadcastRow
): Promise<boolean> {
  if (broadcast.cancelledAt || broadcast.status === 'cancelled') {
    await prisma.newsletterBroadcast.update({
      data: {
        cancelledAt: broadcast.cancelledAt ?? new Date(),
        status: 'cancelled',
      },
      where: { id: broadcast.id },
    });
    await cancelQueuedNewsletterDeliveries(broadcast.id);
    return true;
  }

  if (broadcast.pausedAt || broadcast.status === 'paused') {
    await prisma.newsletterBroadcast.update({
      data: { pausedAt: broadcast.pausedAt ?? new Date(), status: 'paused' },
      where: { id: broadcast.id },
    });
    return true;
  }

  return false;
}

async function requeueFutureNewsletterBroadcast(
  broadcast: NewsletterBroadcastRow
): Promise<boolean> {
  if (!broadcast.scheduledAt || broadcast.scheduledAt.getTime() <= Date.now()) {
    return false;
  }

  const enqueueResult = await enqueueNewsletterBroadcast({
    broadcastId: broadcast.id,
    scheduledAt: broadcast.scheduledAt,
  });
  if (!enqueueResult.ok) {
    throw new Error(
      `Newsletter scheduled enqueue failed: ${enqueueResult.error}`
    );
  }
  return true;
}

async function startNewsletterBroadcast(broadcast: NewsletterBroadcastRow) {
  await prisma.newsletterBroadcast.update({
    data: { startedAt: broadcast.startedAt ?? new Date(), status: 'sending' },
    where: { id: broadcast.id },
  });
}

async function getNewsletterDeliveryBatch(broadcastId: string) {
  const deliveries = await prisma.newsletterDelivery.findMany({
    orderBy: { queuedAt: 'asc' },
    select: { id: true },
    take: NEWSLETTER_DELIVERY_BATCH_SIZE,
    where: retryableDeliveryWhere(broadcastId),
  });
  return deliveries;
}

async function currentBroadcastAllowsSending(
  broadcastId: string
): Promise<boolean> {
  const broadcast = await prisma.newsletterBroadcast.findUnique({
    select: { cancelledAt: true, pausedAt: true, status: true },
    where: { id: broadcastId },
  });
  if (!broadcast || broadcast.cancelledAt || broadcast.status === 'cancelled') {
    await cancelQueuedNewsletterDeliveries(broadcastId);
    return false;
  }

  return !broadcast.pausedAt && broadcast.status !== 'paused';
}

async function claimNewsletterDelivery(deliveryId: string): Promise<boolean> {
  const claimed = await prisma.newsletterDelivery.updateMany({
    data: {
      attemptCount: { increment: 1 },
      failedAt: null,
      lastError: null,
      status: 'sending',
    },
    where: {
      id: deliveryId,
      attemptCount: { lt: NEWSLETTER_DELIVERY_MAX_ATTEMPTS },
      status: { in: ['failed', 'queued'] },
    },
  });
  return claimed.count > 0;
}

async function findClaimedNewsletterDelivery(deliveryId: string) {
  const delivery = await prisma.newsletterDelivery.findUnique({
    include: {
      primaryList: true,
      subscriber: {
        include: {
          subscriptions: {
            select: { listId: true, status: true },
          },
          user: {
            select: { emailVerified: true },
          },
        },
      },
    },
    where: { id: deliveryId },
  });
  return delivery;
}

type ClaimedNewsletterDelivery = NonNullable<
  Awaited<ReturnType<typeof findClaimedNewsletterDelivery>>
>;

function isNewsletterDeliveryEligible(delivery: ClaimedNewsletterDelivery) {
  const subscription = delivery.subscriber.subscriptions.find(
    (item) => item.listId === delivery.primaryListId
  );
  if (delivery.subscriber.userId && !delivery.subscriber.user?.emailVerified) {
    return false;
  }
  return (
    !delivery.subscriber.globalUnsubscribedAt &&
    !delivery.subscriber.suppressedAt &&
    subscription?.status === 'subscribed'
  );
}

async function suppressNewsletterDelivery(
  broadcastId: string,
  delivery: ClaimedNewsletterDelivery
) {
  await prisma.newsletterDelivery.update({
    data: {
      failedAt: new Date(),
      lastError: 'recipient not eligible at send time',
      status: 'suppressed',
    },
    where: { id: delivery.id },
  });
  await prisma.newsletterEvent.create({
    data: {
      broadcastId,
      deliveryId: delivery.id,
      email: delivery.email,
      listId: delivery.primaryListId,
      subscriberId: delivery.subscriberId,
      type: 'suppressed',
    },
  });
}

async function markNewsletterDeliverySent(
  broadcastId: string,
  delivery: ClaimedNewsletterDelivery,
  providerMessageId: string | null
) {
  await prisma.newsletterDelivery.update({
    data: {
      providerMessageId,
      sentAt: new Date(),
      status: 'sent',
    },
    where: { id: delivery.id },
  });
  try {
    await prisma.newsletterEvent.create({
      data: {
        broadcastId,
        deliveryId: delivery.id,
        email: delivery.email,
        listId: delivery.primaryListId,
        providerMessageId,
        subscriberId: delivery.subscriberId,
        type: 'sent',
      },
    });
  } catch (error) {
    logger.error('Failed to record newsletter sent event: {error}', {
      broadcastId,
      deliveryId: delivery.id,
      error,
      providerMessageId,
    });
  }
}

async function markNewsletterDeliveryFailed(
  broadcastId: string,
  delivery: ClaimedNewsletterDelivery,
  error: unknown
) {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.newsletterDelivery.update({
    data: {
      failedAt: new Date(),
      lastError: message,
      status: 'failed',
    },
    where: { id: delivery.id },
  });
  try {
    await prisma.newsletterEvent.create({
      data: {
        broadcastId,
        deliveryId: delivery.id,
        email: delivery.email,
        listId: delivery.primaryListId,
        subscriberId: delivery.subscriberId,
        type: 'failed',
      },
    });
  } catch (eventError) {
    logger.error('Failed to record newsletter failed event: {error}', {
      broadcastId,
      deliveryId: delivery.id,
      error: eventError,
    });
  }
}

async function sendClaimedNewsletterDelivery(
  broadcast: NewsletterBroadcastRow,
  delivery: ClaimedNewsletterDelivery
) {
  let providerMessageId: string | null;
  try {
    const { providerMessageId: sentProviderMessageId } =
      await sendNewsletterBroadcastEmail({
        body: broadcast.body,
        broadcastId: broadcast.id,
        deliveryId: delivery.id,
        email: delivery.email,
        listId: delivery.primaryListId,
        listName: delivery.primaryList.name,
        manageTokenHash: delivery.subscriber.manageTokenHash,
        previewText: broadcast.previewText,
        subject: broadcast.subject,
        subscriberId: delivery.subscriberId,
        topicId: delivery.primaryList.resendTopicId,
      });
    providerMessageId = sentProviderMessageId;
  } catch (error) {
    await markNewsletterDeliveryFailed(broadcast.id, delivery, error);
    return;
  }

  await markNewsletterDeliverySent(broadcast.id, delivery, providerMessageId);
}

async function processNewsletterDeliveryBatch(
  broadcast: NewsletterBroadcastRow
) {
  const deliveries = await getNewsletterDeliveryBatch(broadcast.id);
  for (const queuedDelivery of deliveries) {
    if (!(await currentBroadcastAllowsSending(broadcast.id))) {
      return;
    }
    if (!(await claimNewsletterDelivery(queuedDelivery.id))) {
      continue;
    }

    const delivery = await findClaimedNewsletterDelivery(queuedDelivery.id);
    if (!delivery) {
      continue;
    }
    if (!isNewsletterDeliveryEligible(delivery)) {
      await suppressNewsletterDelivery(broadcast.id, delivery);
      continue;
    }

    await sendClaimedNewsletterDelivery(broadcast, delivery);
  }
}

async function requeueNewsletterContinuation(
  broadcastId: string
): Promise<boolean> {
  const remainingRetryable = await prisma.newsletterDelivery.count({
    where: retryableDeliveryWhere(broadcastId),
  });
  if (remainingRetryable === 0) {
    return false;
  }

  const nextDelivery = await prisma.newsletterDelivery.findFirst({
    orderBy: { queuedAt: 'asc' },
    select: { id: true },
    where: retryableDeliveryWhere(broadcastId),
  });
  const enqueueResult = await enqueueNewsletterBroadcast({
    broadcastId,
    continuationKey: nextDelivery?.id ?? String(Date.now()),
    scheduledAt: new Date(Date.now() + NEWSLETTER_CONTINUATION_DELAY_MS),
  });
  if (!enqueueResult.ok) {
    throw new Error(
      `Newsletter continuation enqueue failed: ${enqueueResult.error}`
    );
  }
  return true;
}

async function finishNewsletterBroadcast(broadcastId: string) {
  const [nonTerminal, failed] = await Promise.all([
    prisma.newsletterDelivery.count({
      where: { broadcastId, status: { in: ['queued', 'sending'] } },
    }),
    prisma.newsletterDelivery.count({
      where: { broadcastId, status: 'failed' },
    }),
  ]);
  if (nonTerminal > 0) {
    throw new Error(
      `Newsletter broadcast ${broadcastId} has unfinished deliveries`
    );
  }
  await prisma.newsletterBroadcast.update({
    data: {
      sentAt: failed === 0 ? new Date() : null,
      status: failed === 0 ? 'sent' : 'failed',
    },
    where: { id: broadcastId },
  });
  if (failed > 0) {
    return;
  }
  const revalidated = await requestNewsletterArchiveRevalidation();
  if (!revalidated) {
    logger.warn(
      'Failed to revalidate newsletter archive after broadcast send',
      {
        broadcastId,
      }
    );
  }
}

/**
 * Sends a batch of queued deliveries for one broadcast.
 *
 * @param broadcastId - Broadcast id
 */
export async function processNewsletterBroadcast(
  broadcastId: string
): Promise<void> {
  const broadcast = await findNewsletterBroadcast(broadcastId);
  if (!broadcast || (await stopInactiveNewsletterBroadcast(broadcast))) {
    return;
  }
  if (!['failed', 'queued', 'sending'].includes(broadcast.status)) {
    return;
  }
  if (await requeueFutureNewsletterBroadcast(broadcast)) {
    return;
  }

  await startNewsletterBroadcast(broadcast);
  await processNewsletterDeliveryBatch(broadcast);
  if (await requeueNewsletterContinuation(broadcast.id)) {
    return;
  }
  await finishNewsletterBroadcast(broadcast.id);
}
