import 'server-only';
import { prisma } from '@/libs/DB';
import { sendNewsletterBroadcastEmail } from '@/libs/newsletter/newsletterEmail';

type CreateBroadcastParams = {
  body: string;
  createdByUserId: string;
  listIds: readonly string[];
  name: string | null;
  previewText: string;
  queueForSending: boolean;
  subject: string;
  templateId: string;
};

export type CreateNewsletterBroadcastResult =
  | { ok: true; broadcastId: string; queued: boolean }
  | {
      ok: false;
      error: 'invalid_lists' | 'invalid_template' | 'no_recipients';
    };

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
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

/**
 * Creates a broadcast and, when requested, materializes per-subscriber deliveries.
 *
 * @param params - Broadcast form data
 * @returns Created broadcast id or validation error
 */
export async function createNewsletterBroadcast(
  params: CreateBroadcastParams
): Promise<CreateNewsletterBroadcastResult> {
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
    const created = await tx.newsletterBroadcast.create({
      data: {
        body: params.body,
        createdByUserId: params.createdByUserId,
        name: params.name,
        previewText: params.previewText,
        primaryListId: primaryList.id,
        queuedAt: params.queueForSending ? new Date() : null,
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
        type: params.queueForSending ? 'broadcast_queued' : 'broadcast_created',
      },
    });

    if (params.queueForSending) {
      await tx.newsletterDelivery.createMany({
        data: [...recipientBySubscriberId.values()].map((recipient) => ({
          broadcastId: created.id,
          email: recipient.subscriber.email,
          primaryListId: recipient.listId,
          subscriberId: recipient.subscriber.id,
        })),
      });
    }

    return created;
  });

  return {
    ok: true,
    broadcastId: broadcast.id,
    queued: params.queueForSending,
  };
}

/**
 * Sends all queued deliveries for one broadcast.
 *
 * @param broadcastId - Broadcast id
 */
export async function processNewsletterBroadcast(
  broadcastId: string
): Promise<void> {
  const broadcast = await prisma.newsletterBroadcast.findUnique({
    include: {
      deliveries: {
        include: {
          primaryList: true,
          subscriber: true,
        },
        orderBy: { queuedAt: 'asc' },
        where: { status: { in: ['queued', 'failed'] } },
      },
    },
    where: { id: broadcastId },
  });
  if (
    !broadcast ||
    !['failed', 'queued', 'sending'].includes(broadcast.status)
  ) {
    return;
  }

  await prisma.newsletterBroadcast.update({
    data: { status: 'sending' },
    where: { id: broadcast.id },
  });

  for (const delivery of broadcast.deliveries) {
    await prisma.newsletterDelivery.update({
      data: {
        attemptCount: { increment: 1 },
        lastError: null,
        status: 'sending',
      },
      where: { id: delivery.id },
    });

    try {
      const result = await sendNewsletterBroadcastEmail({
        body: broadcast.body,
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
      await prisma.newsletterDelivery.update({
        data: {
          providerMessageId: result.providerMessageId,
          sentAt: new Date(),
          status: 'sent',
        },
        where: { id: delivery.id },
      });
      await prisma.newsletterEvent.create({
        data: {
          broadcastId: broadcast.id,
          deliveryId: delivery.id,
          email: delivery.email,
          listId: delivery.primaryListId,
          providerMessageId: result.providerMessageId,
          subscriberId: delivery.subscriberId,
          type: 'sent',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.newsletterDelivery.update({
        data: {
          failedAt: new Date(),
          lastError: message,
          status: 'failed',
        },
        where: { id: delivery.id },
      });
      await prisma.newsletterEvent.create({
        data: {
          broadcastId: broadcast.id,
          deliveryId: delivery.id,
          email: delivery.email,
          listId: delivery.primaryListId,
          subscriberId: delivery.subscriberId,
          type: 'failed',
        },
      });
    }
  }

  const remaining = await prisma.newsletterDelivery.count({
    where: {
      broadcastId: broadcast.id,
      status: { in: ['queued', 'sending', 'failed'] },
    },
  });
  await prisma.newsletterBroadcast.update({
    data: {
      sentAt: remaining === 0 ? new Date() : null,
      status: remaining === 0 ? 'sent' : 'failed',
    },
    where: { id: broadcast.id },
  });
  if (remaining > 0) {
    throw new Error(
      `Newsletter broadcast ${broadcast.id} has failed deliveries`
    );
  }
}
