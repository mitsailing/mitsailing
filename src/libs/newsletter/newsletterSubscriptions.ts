import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/libs/DB';
import {
  isNewsletterListSlug,
  NEWSLETTER_FORM_SOURCE,
} from '@/libs/newsletter/newsletterConstants';
import type { NewsletterListSlug } from '@/libs/newsletter/newsletterConstants';
import {
  createNewsletterTokenPair,
  verifyNewsletterManageToken,
} from '@/libs/newsletter/newsletterTokens';
import { normalizeNewsletterEmail } from '@/libs/newsletter/newsletterValidation';

type RequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type SubscribeParams = RequestMetadata & {
  email: string;
  listSlugs: readonly NewsletterListSlug[];
  name?: string | null;
  source: string;
};

type UpdatePreferencesParams = {
  actorUserId?: string | null;
  listIds: readonly string[];
  source: string;
  subscriberId: string;
};

type SubscriberWithPreferences = Awaited<
  ReturnType<typeof getSubscriberPreferenceStateByToken>
>;

type NewsletterSubscriptionClient = Prisma.TransactionClient | typeof prisma;

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function eventTypeForSubscribed(
  previousStatus: 'subscribed' | 'unsubscribed' | null
) {
  return previousStatus === 'unsubscribed' ? 'resubscribed' : 'subscribed';
}

function shouldRecordPreferenceEvent(
  existingStatus: 'subscribed' | 'unsubscribed' | null,
  isSelected: boolean
) {
  const nextStatus = isSelected ? 'subscribed' : 'unsubscribed';
  if (existingStatus === nextStatus) {
    return false;
  }
  return isSelected || existingStatus === 'subscribed';
}

async function publicNewsletterListsBySlug(
  client: NewsletterSubscriptionClient,
  slugs: readonly NewsletterListSlug[]
) {
  const lists = await client.newsletterList.findMany({
    orderBy: { displayOrder: 'asc' },
    where: {
      isArchived: false,
      slug: { in: [...slugs] },
      visibility: 'public',
    },
  });
  return lists;
}

async function findAccountIdForEmail(
  client: NewsletterSubscriptionClient,
  email: string
): Promise<string | null> {
  const user = await client.user.findUnique({
    select: { id: true },
    where: { email },
  });
  return user?.id ?? null;
}

async function upsertSubscriberForEmail(
  client: NewsletterSubscriptionClient,
  params: SubscribeParams
) {
  const email = normalizeNewsletterEmail(params.email);
  const accountUserId = await findAccountIdForEmail(client, email);
  const existing = await client.newsletterSubscriber.findUnique({
    where: { email },
  });

  if (existing) {
    return client.newsletterSubscriber.update({
      data: {
        consentIpAddress: params.ipAddress ?? existing.consentIpAddress,
        consentUserAgent: params.userAgent ?? existing.consentUserAgent,
        consentedAt: new Date(),
        globalUnsubscribedAt: null,
        name: params.name ?? existing.name,
        source: params.source,
        userId: existing.userId ?? accountUserId,
      },
      where: { id: existing.id },
    });
  }

  const token = createNewsletterTokenPair();
  return client.newsletterSubscriber.create({
    data: {
      consentIpAddress: params.ipAddress ?? null,
      consentUserAgent: params.userAgent ?? null,
      email,
      manageTokenHash: token.hash,
      name: params.name ?? null,
      source: params.source,
      userId: accountUserId,
    },
  });
}

/**
 * Lists public newsletter topics shown in signup and preference forms.
 *
 * @returns Ordered newsletter lists
 */
export async function getPublicNewsletterLists() {
  const lists = await prisma.newsletterList.findMany({
    orderBy: { displayOrder: 'asc' },
    where: { isArchived: false, visibility: 'public' },
  });
  return lists;
}

/**
 * Subscribes an email to selected public lists, always including General.
 *
 * @param params - Subscription payload and request metadata
 * @returns The subscriber id that was updated
 */
export async function subscribeEmailToNewsletterLists(params: SubscribeParams) {
  const requestedSlugs = uniqueStrings(['general', ...params.listSlugs]).filter(
    (slug): slug is NewsletterListSlug => isNewsletterListSlug(slug)
  );
  const result = await prisma.$transaction(async (tx) => {
    const lists = await publicNewsletterListsBySlug(tx, requestedSlugs);
    const subscriber = await upsertSubscriberForEmail(tx, params);

    for (const list of lists) {
      const existing = await tx.newsletterSubscription.findUnique({
        select: { status: true },
        where: {
          subscriberId_listId: {
            listId: list.id,
            subscriberId: subscriber.id,
          },
        },
      });
      const isAlreadySubscribed = existing?.status === 'subscribed';
      await tx.newsletterSubscription.upsert({
        create: {
          listId: list.id,
          source: params.source,
          subscriberId: subscriber.id,
        },
        update: {
          source: params.source,
          status: 'subscribed',
          ...(isAlreadySubscribed
            ? {}
            : { subscribedAt: new Date(), unsubscribedAt: null }),
        },
        where: {
          subscriberId_listId: {
            listId: list.id,
            subscriberId: subscriber.id,
          },
        },
      });
      if (existing?.status !== 'subscribed') {
        await tx.newsletterEvent.create({
          data: {
            email: subscriber.email,
            listId: list.id,
            subscriberId: subscriber.id,
            type: eventTypeForSubscribed(existing?.status ?? null),
          },
        });
      }
    }

    return { subscriberId: subscriber.id };
  });
  return result;
}

/**
 * Ensures a verified account has a subscriber row without overwriting preferences.
 *
 * @param userId - Account id
 */
export async function ensureNewsletterSubscriberForUser(
  userId: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    select: { email: true, id: true, name: true },
    where: { id: userId },
  });
  if (!user) {
    return;
  }

  const existing = await prisma.newsletterSubscriber.findUnique({
    select: { id: true, userId: true },
    where: { email: user.email },
  });
  if (existing) {
    if (!existing.userId) {
      await prisma.newsletterSubscriber.update({
        data: { userId: user.id },
        where: { id: existing.id },
      });
    }
    return;
  }

  await subscribeEmailToNewsletterLists({
    email: user.email,
    listSlugs: ['general'],
    name: user.name,
    source: NEWSLETTER_FORM_SOURCE.accountSignup,
  });
}

/**
 * Returns a read-only subscriber preference view for an authenticated user.
 *
 * @param userId - Account id
 * @returns Subscriber plus public lists and subscriptions
 */
export async function getExistingSubscriberPreferenceStateForUser(
  userId: string
) {
  const user = await prisma.user.findUnique({
    select: { email: true },
    where: { id: userId },
  });
  if (!user) {
    return null;
  }
  return prisma.newsletterSubscriber.findUnique({
    include: {
      subscriptions: {
        include: { list: true },
        orderBy: { list: { displayOrder: 'asc' } },
        where: { list: { isArchived: false, visibility: 'public' } },
      },
    },
    where: { email: user.email },
  });
}

/**
 * Ensures then returns a subscriber preference view for an authenticated user.
 *
 * @param userId - Account id
 * @returns Subscriber plus public lists and subscriptions
 */
export async function getSubscriberPreferenceStateForUser(userId: string) {
  await ensureNewsletterSubscriberForUser(userId);
  return getExistingSubscriberPreferenceStateForUser(userId);
}

/**
 * Returns a subscriber preference view for a tokenized public manage link.
 *
 * @param token - Raw manage token from email
 * @returns Subscriber plus public list subscriptions
 */
export async function getSubscriberPreferenceStateByToken(token: string) {
  const [subscriberId] = token.split('.');
  if (!subscriberId) {
    return null;
  }
  const subscriber = await prisma.newsletterSubscriber.findUnique({
    select: { manageTokenHash: true },
    where: { id: subscriberId },
  });
  if (!subscriber) {
    return null;
  }
  const verifiedSubscriberId = verifyNewsletterManageToken(
    token,
    subscriber.manageTokenHash
  );
  if (!verifiedSubscriberId) {
    return null;
  }
  return prisma.newsletterSubscriber.findUnique({
    include: {
      subscriptions: {
        include: { list: true },
        orderBy: { list: { displayOrder: 'asc' } },
        where: { list: { isArchived: false, visibility: 'public' } },
      },
    },
    where: { id: verifiedSubscriberId },
  });
}

/**
 * Applies an exact public-list preference set for a subscriber.
 *
 * @param params - Subscriber and selected list ids
 */
export async function updateNewsletterPreferences(
  params: UpdatePreferencesParams
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const publicLists = await tx.newsletterList.findMany({
      orderBy: { displayOrder: 'asc' },
      where: { isArchived: false, visibility: 'public' },
    });
    const selected = new Set(params.listIds);
    const publicListIds = new Set(publicLists.map((list) => list.id));
    const invalidListIds = [...selected].filter(
      (listId) => !publicListIds.has(listId)
    );
    if (invalidListIds.length > 0) {
      throw new Error(
        `Invalid newsletter list selection: ${invalidListIds.join(', ')}`
      );
    }
    const selectedPublicListIds = new Set(selected);
    const subscriber = await tx.newsletterSubscriber.findUnique({
      select: { email: true, id: true },
      where: { id: params.subscriberId },
    });
    if (!subscriber) {
      throw new Error(
        `Newsletter subscriber not found: ${params.subscriberId}`
      );
    }

    const now = new Date();
    const anySelected = selectedPublicListIds.size > 0;
    await tx.newsletterSubscriber.update({
      data: { globalUnsubscribedAt: anySelected ? null : now },
      where: { id: params.subscriberId },
    });

    for (const list of publicLists) {
      const isSelected = selectedPublicListIds.has(list.id);
      const nextStatus = isSelected ? 'subscribed' : 'unsubscribed';
      const existing = await tx.newsletterSubscription.findUnique({
        select: { status: true },
        where: {
          subscriberId_listId: {
            listId: list.id,
            subscriberId: params.subscriberId,
          },
        },
      });
      await tx.newsletterSubscription.upsert({
        create: {
          listId: list.id,
          source: params.source,
          status: nextStatus,
          subscriberId: params.subscriberId,
          unsubscribedAt: isSelected ? null : now,
        },
        update: {
          source: params.source,
          status: nextStatus,
          ...(existing?.status === nextStatus
            ? {}
            : {
                subscribedAt: isSelected ? now : undefined,
                unsubscribedAt: isSelected ? null : now,
              }),
        },
        where: {
          subscriberId_listId: {
            listId: list.id,
            subscriberId: params.subscriberId,
          },
        },
      });

      if (!shouldRecordPreferenceEvent(existing?.status ?? null, isSelected)) {
        continue;
      }

      await tx.newsletterEvent.create({
        data: {
          actorUserId: params.actorUserId ?? null,
          email: subscriber.email,
          listId: list.id,
          subscriberId: subscriber.id,
          type: isSelected
            ? eventTypeForSubscribed(existing?.status ?? null)
            : 'unsubscribed',
        },
      });
    }

    if (!anySelected) {
      await tx.newsletterEvent.create({
        data: {
          actorUserId: params.actorUserId ?? null,
          email: subscriber.email,
          subscriberId: subscriber.id,
          type: 'unsubscribed_all',
        },
      });
    }
  });
}

/**
 * Unsubscribes a tokenized subscriber from one public list.
 *
 * @param token - Raw manage token from email
 * @param listId - Newsletter list id
 * @returns Subscriber state after the update, or null for invalid token or list
 */
export async function unsubscribeNewsletterTokenFromList(
  token: string,
  listId: string
): Promise<SubscriberWithPreferences> {
  const subscriber = await getSubscriberPreferenceStateByToken(token);
  if (!subscriber) {
    return null;
  }

  const list = await prisma.newsletterList.findFirst({
    select: { id: true },
    where: { id: listId, isArchived: false, visibility: 'public' },
  });
  if (!list) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const subscriberRow = await tx.newsletterSubscriber.findUnique({
      select: { globalUnsubscribedAt: true },
      where: { id: subscriber.id },
    });
    const existingSubscription = await tx.newsletterSubscription.findUnique({
      where: {
        subscriberId_listId: { listId: list.id, subscriberId: subscriber.id },
      },
    });
    if (existingSubscription?.status !== 'unsubscribed') {
      await tx.newsletterSubscription.upsert({
        create: {
          listId: list.id,
          source: NEWSLETTER_FORM_SOURCE.oneClickUnsubscribe,
          status: 'unsubscribed',
          subscriberId: subscriber.id,
          unsubscribedAt: now,
        },
        update: {
          source: NEWSLETTER_FORM_SOURCE.oneClickUnsubscribe,
          status: 'unsubscribed',
          unsubscribedAt: now,
        },
        where: {
          subscriberId_listId: { listId: list.id, subscriberId: subscriber.id },
        },
      });
      await tx.newsletterEvent.create({
        data: {
          email: subscriber.email,
          listId: list.id,
          subscriberId: subscriber.id,
          type: 'unsubscribed',
        },
      });
    }

    const remainingSubscribed = await tx.newsletterSubscription.count({
      where: {
        list: { isArchived: false, visibility: 'public' },
        status: 'subscribed',
        subscriberId: subscriber.id,
      },
    });
    const isGloballyUnsubscribed = remainingSubscribed === 0;
    await tx.newsletterSubscriber.update({
      data: { globalUnsubscribedAt: isGloballyUnsubscribed ? now : null },
      where: { id: subscriber.id },
    });
    if (isGloballyUnsubscribed && !subscriberRow?.globalUnsubscribedAt) {
      await tx.newsletterEvent.create({
        data: {
          email: subscriber.email,
          subscriberId: subscriber.id,
          type: 'unsubscribed_all',
        },
      });
    }
  });

  return getSubscriberPreferenceStateByToken(token);
}
