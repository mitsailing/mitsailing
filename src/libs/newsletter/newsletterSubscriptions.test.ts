import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateNewsletterPreferences } from '@/libs/newsletter/newsletterSubscriptions';

const mocks = vi.hoisted(() => {
  const newsletterEvent = {
    create: vi.fn(),
  };
  const newsletterList = {
    findMany: vi.fn(),
  };
  const newsletterSubscriber = {
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const newsletterSubscription = {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  };
  const transaction = {
    newsletterEvent,
    newsletterList,
    newsletterSubscriber,
    newsletterSubscription,
  };

  return {
    prisma: {
      $transaction: vi.fn(
        async (operation: (tx: typeof transaction) => Promise<unknown>) => {
          const result = await operation(transaction);
          return result;
        }
      ),
      newsletterEvent,
      newsletterList,
      newsletterSubscriber,
      newsletterSubscription,
      user: {
        findUnique: vi.fn(),
      },
    },
    transaction,
  };
});

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/libs/newsletter/newsletterTokens', () => ({
  createNewsletterTokenPair: vi.fn(() => ({
    hash: 'token_hash',
    token: 'subscriber_123.raw_token',
  })),
  verifyNewsletterManageToken: vi.fn(() => 'subscriber_123'),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-14T14:30:00.000Z'));
  vi.clearAllMocks();
  mocks.transaction.newsletterList.findMany.mockResolvedValue([
    { id: 'general_id' },
    { id: 'racing_id' },
  ]);
  mocks.transaction.newsletterSubscriber.findUnique.mockResolvedValue({
    email: 'sailor@example.com',
    id: 'subscriber_123',
  });
  mocks.transaction.newsletterSubscriber.update.mockResolvedValue({});
  mocks.transaction.newsletterSubscription.findUnique.mockResolvedValue(null);
  mocks.transaction.newsletterSubscription.upsert.mockResolvedValue({});
  mocks.transaction.newsletterEvent.create.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('updateNewsletterPreferences', () => {
  it('filters selected ids to public lists in transaction', async () => {
    await updateNewsletterPreferences({
      actorUserId: 'user_123',
      listIds: ['general_id', 'private_id'],
      source: 'profile',
      subscriberId: 'subscriber_123',
    });

    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.transaction.newsletterSubscriber.update).toHaveBeenCalledWith({
      data: { globalUnsubscribedAt: null },
      where: { id: 'subscriber_123' },
    });
    expect(
      mocks.transaction.newsletterSubscription.upsert
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          listId: 'general_id',
          status: 'subscribed',
        }),
      })
    );
    expect(
      mocks.transaction.newsletterSubscription.upsert
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          listId: 'racing_id',
          status: 'unsubscribed',
          unsubscribedAt: new Date('2026-05-14T14:30:00.000Z'),
        }),
      })
    );
    expect(
      mocks.transaction.newsletterSubscription.upsert
    ).not.toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ listId: 'private_id' }),
      })
    );
    expect(
      mocks.transaction.newsletterSubscription.upsert
    ).toHaveBeenCalledTimes(2);
  });

  it('globally unsubscribes when no submitted ids are public', async () => {
    await updateNewsletterPreferences({
      listIds: ['private_id'],
      source: 'token_manage',
      subscriberId: 'subscriber_123',
    });

    expect(mocks.transaction.newsletterSubscriber.update).toHaveBeenCalledWith({
      data: {
        globalUnsubscribedAt: new Date('2026-05-14T14:30:00.000Z'),
      },
      where: { id: 'subscriber_123' },
    });
    expect(mocks.transaction.newsletterEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subscriberId: 'subscriber_123',
        type: 'unsubscribed_all',
      }),
    });
  });
});
