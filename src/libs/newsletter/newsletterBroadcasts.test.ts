import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    newsletterBroadcast: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    newsletterDelivery: { createMany: vi.fn() },
    newsletterEvent: { create: vi.fn() },
  };
  return {
    enqueueNewsletterBroadcast: vi.fn(),
    fetch: vi.fn(),
    logger: { error: vi.fn(), warn: vi.fn() },
    getNewsletterPostalAddress: vi.fn(async () => {
      await Promise.resolve();
      return 'MIT Sailing Pavilion';
    }),
    prisma: {
      $transaction: vi.fn(),
      newsletterBroadcast: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      newsletterDelivery: {
        count: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      newsletterEvent: { create: vi.fn() },
      newsletterList: { findMany: vi.fn() },
      newsletterSubscription: { findMany: vi.fn() },
      newsletterTemplate: { findUnique: vi.fn() },
    },
    renderNewsletterBroadcastEmail: vi.fn(),
    sendNewsletterBroadcastEmail: vi.fn(),
    tx,
  };
});

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/libs/Env', () => ({
  Env: {
    BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-thirty-two-chars',
    NEWSLETTER_REVALIDATE_SECRET:
      'test-newsletter-revalidate-secret-with-thirty-two-chars',
    REDIS_URL: 'redis://localhost:6379',
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: mocks.logger,
}));

vi.mock('@/libs/newsletter/newsletterEmail', () => ({
  getNewsletterPostalAddress: mocks.getNewsletterPostalAddress,
  renderNewsletterBroadcastEmail: mocks.renderNewsletterBroadcastEmail,
  sendNewsletterBroadcastEmail: mocks.sendNewsletterBroadcastEmail,
}));

vi.mock('@/libs/newsletter/newsletterQueue', () => ({
  enqueueNewsletterBroadcast: mocks.enqueueNewsletterBroadcast,
}));

vi.mock('@/utils/Helpers', () => ({
  getBaseUrl: () => 'https://mitsailing.test',
}));

type TransactionOperation = (tx: typeof mocks.tx) => Promise<unknown>;

function isPromiseList(input: unknown): input is Promise<unknown>[] {
  return Array.isArray(input);
}

function isTransactionOperation(input: unknown): input is TransactionOperation {
  return typeof input === 'function';
}

function resetTransactionMock() {
  mocks.prisma.$transaction.mockImplementation(async (input: unknown) => {
    if (isPromiseList(input)) {
      const result = await Promise.all(input);
      return result;
    }
    if (isTransactionOperation(input)) {
      const result = await input(mocks.tx);
      return result;
    }
    throw new Error('Unsupported transaction input.');
  });
}

function mockDeliveryFinishSnapshot(params: {
  failedDeliveryCount?: number;
  nonTerminal?: number;
  totalDeliveryCount?: number;
}) {
  mocks.tx.$queryRaw.mockImplementation(
    async (strings: TemplateStringsArray) => {
      await Promise.resolve();
      const sql = strings.join('');
      if (sql.includes('FOR UPDATE')) {
        return [];
      }
      return [
        {
          failed_delivery_count: params.failedDeliveryCount ?? 0,
          non_terminal_count: params.nonTerminal ?? 0,
          total_delivery_count:
            params.totalDeliveryCount ??
            (params.failedDeliveryCount ?? 0) + (params.nonTerminal ?? 0),
        },
      ];
    }
  );
}

function broadcastParams() {
  return {
    body: 'The pavilion is open.',
    createdByUserId: 'user_1',
    listIds: ['list_1'],
    name: 'Spring update',
    previewText: 'News from the pavilion',
    queueForSending: true,
    subject: 'Spring sailing',
    templateId: 'template_1',
  };
}

function queuedBroadcastRow() {
  return {
    body: 'The pavilion is open.',
    cancelledAt: null,
    id: 'broadcast_1',
    pausedAt: null,
    previewText: 'News from the pavilion',
    scheduledAt: null,
    startedAt: null,
    status: 'queued',
    subject: 'Spring sailing',
  };
}

function sendingBroadcastState() {
  return {
    cancelledAt: null,
    pausedAt: null,
    status: 'sending',
  };
}

function queuedDeliveryBatch() {
  return [{ id: 'delivery_1' }];
}

function newsletterDeliveryDetail(
  params: {
    deliveryEmail?: string;
    emailVerified?: boolean;
    subscriberEmail?: string;
    subscriptionStatus?: 'subscribed' | 'unsubscribed';
  } = {}
) {
  const subscriptionStatus = params.subscriptionStatus ?? 'subscribed';
  const account =
    params.emailVerified === undefined
      ? {}
      : { user: { emailVerified: params.emailVerified }, userId: 'user_1' };
  return {
    email: params.deliveryEmail ?? 'sailor@example.com',
    id: 'delivery_1',
    primaryList: { name: 'General', resendTopicId: null },
    primaryListId: 'list_1',
    subscriber: {
      email: params.subscriberEmail ?? 'sailor@example.com',
      globalUnsubscribedAt: null,
      manageTokenHash: 'token_hash',
      subscriptions: [{ listId: 'list_1', status: subscriptionStatus }],
      suppressedAt: null,
      ...account,
    },
    subscriberId: 'subscriber_1',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  resetTransactionMock();
  mocks.prisma.newsletterList.findMany.mockResolvedValue([
    { displayOrder: 1, id: 'list_1' },
  ]);
  mocks.prisma.newsletterTemplate.findUnique.mockResolvedValue({
    id: 'template_1',
  });
  mocks.prisma.newsletterSubscription.findMany.mockResolvedValue([
    {
      listId: 'list_1',
      subscriber: { email: 'sailor@example.com', id: 'subscriber_1' },
    },
  ]);
  mocks.prisma.newsletterBroadcast.update.mockResolvedValue({
    id: 'broadcast_1',
  });
  mocks.prisma.newsletterBroadcast.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.newsletterDelivery.count.mockResolvedValue(0);
  mocks.prisma.newsletterDelivery.findMany.mockResolvedValue([]);
  mocks.prisma.newsletterDelivery.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.newsletterEvent.create.mockResolvedValue({ id: 'event_1' });
  mocks.tx.newsletterBroadcast.create.mockResolvedValue({
    id: 'broadcast_1',
  });
  mocks.tx.newsletterDelivery.createMany.mockResolvedValue({ count: 1 });
  mockDeliveryFinishSnapshot({});
  mocks.tx.newsletterBroadcast.update.mockResolvedValue({ id: 'broadcast_1' });
  mocks.tx.newsletterBroadcast.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.newsletterEvent.create.mockResolvedValue({ id: 'event_1' });
  mocks.enqueueNewsletterBroadcast.mockResolvedValue({ ok: true });
  mocks.fetch.mockResolvedValue(new Response(null, { status: 200 }));
  mocks.sendNewsletterBroadcastEmail.mockResolvedValue({
    providerMessageId: 'message_1',
  });
});

describe('newsletter broadcasts', () => {
  it('returns enqueue error when queue add fails', async () => {
    mocks.enqueueNewsletterBroadcast.mockResolvedValueOnce({
      error: 'redis_unavailable',
      ok: false,
    });

    const { createNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterBroadcasts');
    const result = await createNewsletterBroadcast(broadcastParams());

    expect(result).toEqual({ error: 'redis_unavailable', ok: false });
    expect(mocks.prisma.newsletterBroadcast.update).toHaveBeenCalledWith({
      data: { queuedAt: null, status: 'failed' },
      where: { id: 'broadcast_1' },
    });
    expect(mocks.prisma.newsletterDelivery.updateMany).toHaveBeenCalledWith({
      data: {
        failedAt: expect.any(Date),
        lastError: 'redis_unavailable',
        status: 'failed',
      },
      where: {
        broadcastId: 'broadcast_1',
        status: { in: ['queued', 'sending'] },
      },
    });
    expect(mocks.prisma.newsletterEvent.create).not.toHaveBeenCalled();
  });

  it('records queued event after enqueue succeeds', async () => {
    const { createNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterBroadcasts');
    const result = await createNewsletterBroadcast(broadcastParams());

    expect(result).toEqual({
      broadcastId: 'broadcast_1',
      ok: true,
      queued: true,
    });
    expect(mocks.prisma.newsletterEvent.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 'user_1',
        broadcastId: 'broadcast_1',
        type: 'broadcast_queued',
      },
    });
  });

  it('returns success when queued event insert fails after enqueue', async () => {
    mocks.prisma.newsletterEvent.create.mockRejectedValueOnce(
      new Error('audit failed')
    );

    const { createNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterBroadcasts');
    const result = await createNewsletterBroadcast(broadcastParams());

    expect(result).toEqual({
      broadcastId: 'broadcast_1',
      ok: true,
      queued: true,
    });
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Failed to record newsletter broadcast queued event: {error}',
      {
        actorUserId: 'user_1',
        broadcastId: 'broadcast_1',
        error: expect.any(Error),
      }
    );
  });

  it('does not start sending when broadcast was paused before transition', async () => {
    mocks.prisma.newsletterBroadcast.findUnique.mockResolvedValueOnce(
      queuedBroadcastRow()
    );
    mocks.prisma.newsletterBroadcast.updateMany.mockResolvedValueOnce({
      count: 0,
    });

    const { processNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterBroadcasts');
    await processNewsletterBroadcast('broadcast_1');

    expect(mocks.prisma.newsletterBroadcast.updateMany).toHaveBeenCalledWith({
      data: { startedAt: expect.any(Date), status: 'sending' },
      where: {
        cancelledAt: null,
        id: 'broadcast_1',
        pausedAt: null,
        status: { in: ['failed', 'queued', 'sending'] },
      },
    });
    expect(mocks.prisma.newsletterDelivery.findMany).not.toHaveBeenCalled();
    expect(mocks.sendNewsletterBroadcastEmail).not.toHaveBeenCalled();
  });

  it('limits queued delivery retries by max attempts', async () => {
    mocks.prisma.newsletterBroadcast.findUnique.mockResolvedValueOnce(
      queuedBroadcastRow()
    );

    const { processNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterBroadcasts');
    await processNewsletterBroadcast('broadcast_1');

    expect(mocks.prisma.newsletterDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          attemptCount: { lt: 3 },
          broadcastId: 'broadcast_1',
          status: { in: ['failed', 'queued'] },
        },
      })
    );
    expect(mocks.prisma.newsletterDelivery.updateMany).not.toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledWith(
      new URL(
        '/api/internal/newsletter/archive/revalidate',
        'https://mitsailing.test'
      ),
      {
        headers: {
          authorization:
            'Bearer test-newsletter-revalidate-secret-with-thirty-two-chars',
        },
        method: 'POST',
      }
    );
  });

  it('suppresses unsubscribed deliveries before sending', async () => {
    mocks.prisma.newsletterBroadcast.findUnique
      .mockResolvedValueOnce(queuedBroadcastRow())
      .mockResolvedValueOnce(sendingBroadcastState());
    mocks.prisma.newsletterDelivery.findMany.mockResolvedValueOnce(
      queuedDeliveryBatch()
    );
    mocks.prisma.newsletterDelivery.findUnique.mockResolvedValueOnce(
      newsletterDeliveryDetail({ subscriptionStatus: 'unsubscribed' })
    );

    const { processNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterBroadcasts');
    await processNewsletterBroadcast('broadcast_1');

    expect(mocks.sendNewsletterBroadcastEmail).not.toHaveBeenCalled();
    expect(mocks.prisma.newsletterDelivery.update).toHaveBeenCalledWith({
      data: {
        failedAt: expect.any(Date),
        lastError: 'recipient not eligible at send time',
        status: 'suppressed',
      },
      where: { id: 'delivery_1' },
    });
    expect(mocks.prisma.newsletterEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deliveryId: 'delivery_1',
        type: 'suppressed',
      }),
    });
  });

  it('keeps suppressed delivery state when suppressed event insert fails', async () => {
    mocks.prisma.newsletterBroadcast.findUnique
      .mockResolvedValueOnce(queuedBroadcastRow())
      .mockResolvedValueOnce(sendingBroadcastState());
    mocks.prisma.newsletterDelivery.findMany.mockResolvedValueOnce(
      queuedDeliveryBatch()
    );
    mocks.prisma.newsletterDelivery.findUnique.mockResolvedValueOnce(
      newsletterDeliveryDetail({ subscriptionStatus: 'unsubscribed' })
    );
    mocks.prisma.newsletterEvent.create.mockRejectedValueOnce(
      new Error('audit failed')
    );

    const { processNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterBroadcasts');
    await processNewsletterBroadcast('broadcast_1');

    expect(mocks.prisma.newsletterDelivery.update).toHaveBeenCalledWith({
      data: {
        failedAt: expect.any(Date),
        lastError: 'recipient not eligible at send time',
        status: 'suppressed',
      },
      where: { id: 'delivery_1' },
    });
    expect(mocks.prisma.newsletterDelivery.count).toHaveBeenCalled();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Failed to record newsletter suppressed event: {error}',
      {
        broadcastId: 'broadcast_1',
        deliveryId: 'delivery_1',
        email: 'sailor@example.com',
        error: expect.any(Error),
      }
    );
  });

  it('suppresses unverified account deliveries before sending', async () => {
    mocks.prisma.newsletterBroadcast.findUnique
      .mockResolvedValueOnce(queuedBroadcastRow())
      .mockResolvedValueOnce(sendingBroadcastState());
    mocks.prisma.newsletterDelivery.findMany.mockResolvedValueOnce(
      queuedDeliveryBatch()
    );
    mocks.prisma.newsletterDelivery.findUnique.mockResolvedValueOnce(
      newsletterDeliveryDetail({ emailVerified: false })
    );

    const { processNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterBroadcasts');
    await processNewsletterBroadcast('broadcast_1');

    expect(mocks.prisma.newsletterDelivery.findUnique).toHaveBeenCalledWith({
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
      where: { id: 'delivery_1' },
    });
    expect(mocks.sendNewsletterBroadcastEmail).not.toHaveBeenCalled();
    expect(mocks.prisma.newsletterDelivery.update).toHaveBeenCalledWith({
      data: {
        failedAt: expect.any(Date),
        lastError: 'recipient not eligible at send time',
        status: 'suppressed',
      },
      where: { id: 'delivery_1' },
    });
  });

  it('suppresses deliveries with stale queued emails before sending', async () => {
    mocks.prisma.newsletterBroadcast.findUnique
      .mockResolvedValueOnce(queuedBroadcastRow())
      .mockResolvedValueOnce(sendingBroadcastState());
    mocks.prisma.newsletterDelivery.findMany.mockResolvedValueOnce(
      queuedDeliveryBatch()
    );
    mocks.prisma.newsletterDelivery.findUnique.mockResolvedValueOnce(
      newsletterDeliveryDetail({
        deliveryEmail: 'old-sailor@example.com',
        subscriberEmail: 'sailor@example.com',
      })
    );

    const { processNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterBroadcasts');
    await processNewsletterBroadcast('broadcast_1');

    expect(mocks.sendNewsletterBroadcastEmail).not.toHaveBeenCalled();
    expect(mocks.prisma.newsletterDelivery.update).toHaveBeenCalledWith({
      data: {
        failedAt: expect.any(Date),
        lastError: 'recipient not eligible at send time',
        status: 'suppressed',
      },
      where: { id: 'delivery_1' },
    });
  });

  it('keeps sent delivery state when sent event insert fails', async () => {
    mocks.prisma.newsletterBroadcast.findUnique
      .mockResolvedValueOnce(queuedBroadcastRow())
      .mockResolvedValueOnce(sendingBroadcastState());
    mocks.prisma.newsletterDelivery.findMany.mockResolvedValueOnce(
      queuedDeliveryBatch()
    );
    mocks.prisma.newsletterDelivery.findUnique.mockResolvedValueOnce(
      newsletterDeliveryDetail()
    );
    mocks.prisma.newsletterEvent.create.mockRejectedValueOnce(
      new Error('audit failed')
    );

    const { processNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterBroadcasts');
    await processNewsletterBroadcast('broadcast_1');

    expect(mocks.prisma.newsletterDelivery.update).toHaveBeenCalledWith({
      data: {
        providerMessageId: 'message_1',
        sentAt: expect.any(Date),
        status: 'sent',
      },
      where: { id: 'delivery_1' },
    });
    expect(mocks.prisma.newsletterDelivery.count).toHaveBeenCalled();
  });

  it('stops processing when sent delivery state cannot persist', async () => {
    mocks.prisma.newsletterBroadcast.findUnique
      .mockResolvedValueOnce(queuedBroadcastRow())
      .mockResolvedValueOnce(sendingBroadcastState());
    mocks.prisma.newsletterDelivery.findMany.mockResolvedValueOnce(
      queuedDeliveryBatch()
    );
    mocks.prisma.newsletterDelivery.findUnique.mockResolvedValueOnce(
      newsletterDeliveryDetail()
    );
    mocks.prisma.newsletterDelivery.update.mockRejectedValueOnce(
      new Error('state failed')
    );

    const { processNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterBroadcasts');
    await expect(processNewsletterBroadcast('broadcast_1')).rejects.toThrow(
      'state failed'
    );

    expect(mocks.prisma.newsletterDelivery.count).not.toHaveBeenCalled();
  });

  it('leaves broadcasts sending when deliveries remain non-terminal', async () => {
    mocks.prisma.newsletterBroadcast.findUnique.mockResolvedValueOnce(
      queuedBroadcastRow()
    );
    mockDeliveryFinishSnapshot({ nonTerminal: 1 });

    const { processNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterBroadcasts');
    await expect(processNewsletterBroadcast('broadcast_1')).rejects.toThrow(
      'Newsletter broadcast broadcast_1 has unfinished deliveries'
    );

    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'RepeatableRead' }
    );
    expect(mocks.tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.newsletterBroadcast.updateMany).toHaveBeenCalledTimes(
      1
    );
    expect(mocks.prisma.newsletterBroadcast.updateMany).toHaveBeenCalledWith({
      data: { startedAt: expect.any(Date), status: 'sending' },
      where: {
        cancelledAt: null,
        id: 'broadcast_1',
        pausedAt: null,
        status: { in: ['failed', 'queued', 'sending'] },
      },
    });
    expect(mocks.tx.newsletterBroadcast.updateMany).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('completes terminal failed broadcasts without retrying the worker job', async () => {
    mocks.prisma.newsletterBroadcast.findUnique.mockResolvedValueOnce(
      queuedBroadcastRow()
    );
    mockDeliveryFinishSnapshot({ failedDeliveryCount: 1 });

    const { processNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterBroadcasts');
    await expect(processNewsletterBroadcast('broadcast_1')).resolves.toBe(
      undefined
    );

    expect(mocks.tx.newsletterBroadcast.updateMany).toHaveBeenCalledWith({
      data: { sentAt: null, status: 'failed' },
      where: {
        cancelledAt: null,
        id: 'broadcast_1',
        pausedAt: null,
        status: 'sending',
      },
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('marks broadcasts sent when at least one delivery succeeds', async () => {
    mocks.prisma.newsletterBroadcast.findUnique.mockResolvedValueOnce(
      queuedBroadcastRow()
    );
    mockDeliveryFinishSnapshot({
      failedDeliveryCount: 1,
      totalDeliveryCount: 2,
    });

    const { processNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterBroadcasts');
    await processNewsletterBroadcast('broadcast_1');

    expect(mocks.tx.newsletterBroadcast.updateMany).toHaveBeenCalledWith({
      data: { sentAt: expect.any(Date), status: 'sent' },
      where: {
        cancelledAt: null,
        id: 'broadcast_1',
        pausedAt: null,
        status: 'sending',
      },
    });
    expect(mocks.fetch).toHaveBeenCalledWith(
      new URL(
        'https://mitsailing.test/api/internal/newsletter/archive/revalidate'
      ),
      {
        headers: {
          authorization:
            'Bearer test-newsletter-revalidate-secret-with-thirty-two-chars',
        },
        method: 'POST',
      }
    );
  });

  it('marks all-suppressed broadcasts failed without archive revalidation', async () => {
    mocks.prisma.newsletterBroadcast.findUnique.mockResolvedValueOnce(
      queuedBroadcastRow()
    );
    mockDeliveryFinishSnapshot({ failedDeliveryCount: 1 });

    const { processNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterBroadcasts');
    await processNewsletterBroadcast('broadcast_1');

    expect(mocks.tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(mocks.tx.newsletterBroadcast.updateMany).toHaveBeenCalledWith({
      data: { sentAt: null, status: 'failed' },
      where: {
        cancelledAt: null,
        id: 'broadcast_1',
        pausedAt: null,
        status: 'sending',
      },
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('does not finish broadcast when paused before terminal update', async () => {
    mocks.prisma.newsletterBroadcast.findUnique.mockResolvedValueOnce(
      queuedBroadcastRow()
    );
    mocks.tx.newsletterBroadcast.updateMany.mockResolvedValueOnce({ count: 0 });
    mockDeliveryFinishSnapshot({});

    const { processNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterBroadcasts');
    await processNewsletterBroadcast('broadcast_1');

    expect(mocks.tx.newsletterBroadcast.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'sent' }),
      where: {
        cancelledAt: null,
        id: 'broadcast_1',
        pausedAt: null,
        status: 'sending',
      },
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('locks deliveries and aggregates finish counts inside repeatable-read transaction', async () => {
    mocks.prisma.newsletterBroadcast.findUnique.mockResolvedValueOnce(
      queuedBroadcastRow()
    );

    const { processNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterBroadcasts');
    await processNewsletterBroadcast('broadcast_1');

    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'RepeatableRead' }
    );
    expect(mocks.tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.newsletterDelivery.count).toHaveBeenCalledTimes(1);
  });
});
