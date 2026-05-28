import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const env = {
    REDIS_URL: 'redis://localhost:6379',
  };
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
    env,
    queueConstructor,
    quit,
    redisConstructor,
  };
});

vi.mock('bullmq', () => ({
  Queue: mocks.queueConstructor,
}));

vi.mock('ioredis', () => ({
  default: mocks.redisConstructor,
}));

vi.mock('@/libs/Env', () => ({
  Env: mocks.env,
}));

describe('getDefaultQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.env.REDIS_URL = 'redis://localhost:6379';
  });

  it('creates the default queue with the worker-safe redis option', async () => {
    const { getDefaultQueue } = await import('@/worker/defaultQueue');

    const queue = getDefaultQueue();

    expect(mocks.redisConstructor).toHaveBeenCalledWith(
      'redis://localhost:6379',
      { maxRetriesPerRequest: null }
    );
    expect(mocks.queueConstructor).toHaveBeenCalledWith('default', {
      connection: { quit: mocks.quit },
    });
    expect(queue).toEqual({ add: mocks.add, close: mocks.close });
  });

  it('reuses the queue and redis connection across calls', async () => {
    const { getDefaultQueue } = await import('@/worker/defaultQueue');

    const firstQueue = getDefaultQueue();
    const secondQueue = getDefaultQueue();

    expect(secondQueue).toBe(firstQueue);
    expect(mocks.redisConstructor).toHaveBeenCalledOnce();
    expect(mocks.queueConstructor).toHaveBeenCalledOnce();
  });

  it('rejects enqueue access when redis is not configured', async () => {
    mocks.env.REDIS_URL = '';
    const { getDefaultQueue } = await import('@/worker/defaultQueue');

    expect(() => getDefaultQueue()).toThrow(
      'REDIS_URL is required to enqueue background jobs'
    );
    expect(mocks.redisConstructor).not.toHaveBeenCalled();
    expect(mocks.queueConstructor).not.toHaveBeenCalled();
  });
});
