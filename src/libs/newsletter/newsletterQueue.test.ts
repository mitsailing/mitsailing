import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const add = vi.fn();
  const close = vi.fn();
  const handlers = new Map<string, (...args: readonly unknown[]) => void>();
  const loggerError = vi.fn();
  const on = vi.fn(
    (event: string, handler: (...args: readonly unknown[]) => void) => {
      handlers.set(event, handler);
    }
  );
  const quit = vi.fn();
  const queueConstructor = vi.fn(function Queue() {
    return { add, close, on };
  });
  const redisConstructor = vi.fn(function IORedis() {
    return { quit };
  });

  return {
    add,
    close,
    handlers,
    loggerError,
    on,
    queueConstructor,
    quit,
    redisConstructor,
  };
});

vi.mock('server-only', () => ({}));

vi.mock('bullmq', () => ({
  Queue: mocks.queueConstructor,
}));

vi.mock('ioredis', () => ({
  default: mocks.redisConstructor,
}));

vi.mock('@/libs/Env', () => ({
  Env: {
    REDIS_URL: 'redis://localhost:6379',
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mocks.handlers.clear();
  mocks.add.mockResolvedValue({});
});

describe('enqueueNewsletterBroadcast', () => {
  it('reuses queue and redis instances across enqueue calls', async () => {
    const { enqueueNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterQueue');

    await enqueueNewsletterBroadcast('broadcast_1');
    await enqueueNewsletterBroadcast('broadcast_2');

    expect(mocks.redisConstructor).toHaveBeenCalledTimes(1);
    expect(mocks.redisConstructor).toHaveBeenCalledWith(
      'redis://localhost:6379',
      { enableOfflineQueue: false, maxRetriesPerRequest: 1 }
    );
    expect(mocks.queueConstructor).toHaveBeenCalledTimes(1);
    expect(mocks.add).toHaveBeenCalledTimes(2);
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.quit).not.toHaveBeenCalled();
  });

  it('logs BullMQ queue errors', async () => {
    const { enqueueNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterQueue');
    const error = new Error('redis unavailable');

    await enqueueNewsletterBroadcast('broadcast_1');
    mocks.handlers.get('error')?.(error);

    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Newsletter queue error: {error}',
      { error }
    );
  });

  it('sets retry backoff and stable job ids', async () => {
    const { enqueueNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterQueue');

    await enqueueNewsletterBroadcast({
      broadcastId: 'broadcast_1',
      continuationKey: 'delivery_1',
      scheduledAt: new Date('2026-05-14T14:30:00.000Z'),
    });

    expect(mocks.add).toHaveBeenCalledWith(
      'send-broadcast',
      {
        broadcastId: 'broadcast_1',
        scheduledAt: '2026-05-14T14:30:00.000Z',
      },
      expect.objectContaining({
        attempts: 3,
        backoff: { delay: 30_000, type: 'exponential' },
        jobId: 'newsletter-broadcast-broadcast_1-1778769000000-delivery_1',
        removeOnComplete: 100,
        removeOnFail: 500,
      })
    );
  });
});
