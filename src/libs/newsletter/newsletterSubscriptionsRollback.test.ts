import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { prisma as dbPrisma } from '@/libs/DB';
import type { updateNewsletterPreferences as updateNewsletterPreferencesFn } from '@/libs/newsletter/newsletterSubscriptions';

vi.mock('server-only', () => ({}));

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'updateNewsletterPreferences rollback',
  () => {
    let prisma: typeof dbPrisma | null = null;
    let updateNewsletterPreferences: typeof updateNewsletterPreferencesFn;
    const idPrefix = `newsletter_rollback_${randomUUID()}`;
    const subscriberId = `${idPrefix}_subscriber`;
    const selectedListId = `${idPrefix}_selected`;
    const existingListId = `${idPrefix}_existing`;
    const globalUnsubscribedAt = new Date('2026-05-14T14:30:00.000Z');
    const originalDatabaseUrl = process.env.DATABASE_URL;
    const originalTestDatabaseUrl = process.env.TEST_DATABASE_URL;

    function restoreDatabaseEnv() {
      if (originalDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalDatabaseUrl;
      }
      if (originalTestDatabaseUrl === undefined) {
        delete process.env.TEST_DATABASE_URL;
      } else {
        process.env.TEST_DATABASE_URL = originalTestDatabaseUrl;
      }
    }

    beforeAll(async () => {
      if (!originalTestDatabaseUrl) {
        throw new Error('TEST_DATABASE_URL is required for rollback test.');
      }
      process.env.DATABASE_URL = originalTestDatabaseUrl;
      delete process.env.TEST_DATABASE_URL;
      const { prisma: loadedPrisma } = await import('@/libs/DB');
      const { updateNewsletterPreferences: loadedUpdateNewsletterPreferences } =
        await import('@/libs/newsletter/newsletterSubscriptions');
      prisma = loadedPrisma;
      updateNewsletterPreferences = loadedUpdateNewsletterPreferences;
      await prisma.newsletterList.createMany({
        data: [
          {
            displayOrder: 1,
            id: existingListId,
            name: 'Rollback existing',
            slug: `${idPrefix}_existing`,
          },
          {
            displayOrder: 2,
            id: selectedListId,
            name: 'Rollback selected',
            slug: `${idPrefix}_selected`,
          },
        ],
      });
      await prisma.newsletterSubscriber.create({
        data: {
          email: `${idPrefix}@example.com`,
          globalUnsubscribedAt,
          id: subscriberId,
          manageTokenHash: `${idPrefix}_hash`,
          subscriptions: {
            create: {
              listId: existingListId,
              status: 'subscribed',
            },
          },
        },
      });
    });

    afterAll(async () => {
      const client = prisma;
      if (client) {
        await client.newsletterSubscription.deleteMany({
          where: { subscriberId },
        });
        await client.newsletterSubscriber.deleteMany({
          where: { id: subscriberId },
        });
        await client.newsletterList.deleteMany({
          where: { id: { in: [existingListId, selectedListId] } },
        });
        await client.$disconnect();
      }
      restoreDatabaseEnv();
    });

    it('rolls back preference writes when a later event insert fails', async () => {
      if (!prisma) {
        throw new Error('Prisma was not initialized for rollback test.');
      }
      await expect(
        updateNewsletterPreferences({
          actorUserId: `${idPrefix}_missing_user`,
          listIds: [selectedListId],
          source: 'profile',
          subscriberId,
        })
      ).rejects.toThrow();

      const subscriber = await prisma.newsletterSubscriber.findUniqueOrThrow({
        select: { globalUnsubscribedAt: true },
        where: { id: subscriberId },
      });
      const selectedSubscription =
        await prisma.newsletterSubscription.findUnique({
          where: {
            subscriberId_listId: {
              listId: selectedListId,
              subscriberId,
            },
          },
        });

      expect(subscriber.globalUnsubscribedAt).toEqual(globalUnsubscribedAt);
      expect(selectedSubscription).toBeNull();
    });
  }
);
