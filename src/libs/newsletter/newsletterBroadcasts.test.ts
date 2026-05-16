import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = {
    newsletterBroadcast: { create: vi.fn() },
    newsletterDelivery: { createMany: vi.fn() },
    newsletterEvent: { create: vi.fn() },
  };
  return {
    enqueueNewsletterBroadcast: vi.fn(),
    prisma: {
      $transaction: vi.fn(),
      newsletterBroadcast: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
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
    revalidatePath: vi.fn(),
    sendNewsletterBroadcastEmail: vi.fn(),
    tx,
  };
});

vi.mock('server-only', () => ({}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/libs/DB', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/libs/Env', () => ({
  Env: {
    NEWSLETTER_POSTAL_ADDRESS: 'MIT Sailing Pavilion',
    REDIS_URL: 'redis://localhost:6379',
  },
}));

vi.mock('@/libs/newsletter/newsletterEmail', () => ({
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

beforeEach(() => {
  vi.clearAllMocks();
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
  mocks.prisma.newsletterDelivery.count.mockResolvedValue(0);
  mocks.prisma.newsletterDelivery.findMany.mockResolvedValue([]);
  mocks.prisma.newsletterDelivery.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.newsletterEvent.create.mockResolvedValue({ id: 'event_1' });
  mocks.tx.newsletterBroadcast.create.mockResolvedValue({
    id: 'broadcast_1',
  });
  mocks.tx.newsletterDelivery.createMany.mockResolvedValue({ count: 1 });
  mocks.tx.newsletterEvent.create.mockResolvedValue({ id: 'event_1' });
  mocks.enqueueNewsletterBroadcast.mockResolvedValue({ ok: true });
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
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/newsletter/archive');
  });

  it('suppresses unsubscribed deliveries before sending', async () => {
    mocks.prisma.newsletterBroadcast.findUnique
      .mockResolvedValueOnce(queuedBroadcastRow())
      .mockResolvedValueOnce({
        cancelledAt: null,
        pausedAt: null,
        status: 'sending',
      });
    mocks.prisma.newsletterDelivery.findMany.mockResolvedValueOnce([
      { id: 'delivery_1' },
    ]);
    mocks.prisma.newsletterDelivery.findUnique.mockResolvedValueOnce({
      email: 'sailor@example.com',
      id: 'delivery_1',
      primaryList: { name: 'General', resendTopicId: null },
      primaryListId: 'list_1',
      subscriber: {
        globalUnsubscribedAt: null,
        manageTokenHash: 'token_hash',
        subscriptions: [{ listId: 'list_1', status: 'unsubscribed' }],
        suppressedAt: null,
      },
      subscriberId: 'subscriber_1',
    });

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

  it('suppresses unverified account deliveries before sending', async () => {
    mocks.prisma.newsletterBroadcast.findUnique
      .mockResolvedValueOnce(queuedBroadcastRow())
      .mockResolvedValueOnce({
        cancelledAt: null,
        pausedAt: null,
        status: 'sending',
      });
    mocks.prisma.newsletterDelivery.findMany.mockResolvedValueOnce([
      { id: 'delivery_1' },
    ]);
    mocks.prisma.newsletterDelivery.findUnique.mockResolvedValueOnce({
      email: 'sailor@example.com',
      id: 'delivery_1',
      primaryList: { name: 'General', resendTopicId: null },
      primaryListId: 'list_1',
      subscriber: {
        globalUnsubscribedAt: null,
        manageTokenHash: 'token_hash',
        subscriptions: [{ listId: 'list_1', status: 'subscribed' }],
        suppressedAt: null,
        user: { emailVerified: false },
        userId: 'user_1',
      },
      subscriberId: 'subscriber_1',
    });

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

  it('keeps sent delivery state when sent event insert fails', async () => {
    mocks.prisma.newsletterBroadcast.findUnique
      .mockResolvedValueOnce(queuedBroadcastRow())
      .mockResolvedValueOnce({
        cancelledAt: null,
        pausedAt: null,
        status: 'sending',
      });
    mocks.prisma.newsletterDelivery.findMany.mockResolvedValueOnce([
      { id: 'delivery_1' },
    ]);
    mocks.prisma.newsletterDelivery.findUnique.mockResolvedValueOnce({
      email: 'sailor@example.com',
      id: 'delivery_1',
      primaryList: { name: 'General', resendTopicId: null },
      primaryListId: 'list_1',
      subscriber: {
        globalUnsubscribedAt: null,
        manageTokenHash: 'token_hash',
        subscriptions: [{ listId: 'list_1', status: 'subscribed' }],
        suppressedAt: null,
      },
      subscriberId: 'subscriber_1',
    });
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
      .mockResolvedValueOnce({
        cancelledAt: null,
        pausedAt: null,
        status: 'sending',
      });
    mocks.prisma.newsletterDelivery.findMany.mockResolvedValueOnce([
      { id: 'delivery_1' },
    ]);
    mocks.prisma.newsletterDelivery.findUnique.mockResolvedValueOnce({
      email: 'sailor@example.com',
      id: 'delivery_1',
      primaryList: { name: 'General', resendTopicId: null },
      primaryListId: 'list_1',
      subscriber: {
        globalUnsubscribedAt: null,
        manageTokenHash: 'token_hash',
        subscriptions: [{ listId: 'list_1', status: 'subscribed' }],
        suppressedAt: null,
      },
      subscriberId: 'subscriber_1',
    });
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
    mocks.prisma.newsletterDelivery.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    const { processNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterBroadcasts');
    await expect(processNewsletterBroadcast('broadcast_1')).rejects.toThrow(
      'Newsletter broadcast broadcast_1 has unfinished deliveries'
    );

    expect(mocks.prisma.newsletterBroadcast.update).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.newsletterBroadcast.update).toHaveBeenCalledWith({
      data: { startedAt: expect.any(Date), status: 'sending' },
      where: { id: 'broadcast_1' },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
