import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const add = vi.fn();
  const close = vi.fn();
  const quit = vi.fn();
  const queueConstructor = vi.fn(function Queue() {
    return { add, close };
  });
  const redisConstructor = vi.fn(function IORedis() {
    return { quit };
  });

  return {
    add,
    close,
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
    error: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mocks.add.mockResolvedValue({});
});

describe('enqueueNewsletterBroadcast', () => {
  it('reuses queue and redis instances across enqueue calls', async () => {
    const { enqueueNewsletterBroadcast } =
      await import('@/libs/newsletter/newsletterQueue');

    await enqueueNewsletterBroadcast('broadcast_1');
    await enqueueNewsletterBroadcast('broadcast_2');

    expect(mocks.redisConstructor).toHaveBeenCalledTimes(1);
    expect(mocks.queueConstructor).toHaveBeenCalledTimes(1);
    expect(mocks.add).toHaveBeenCalledTimes(2);
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.quit).not.toHaveBeenCalled();
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
        jobId: 'newsletter-broadcast:broadcast_1:1778769000000:delivery_1',
        removeOnComplete: 100,
        removeOnFail: 500,
      })
    );
  });
});
