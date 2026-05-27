import { beforeEach, describe, expect, it, vi } from 'vitest';

type WorkerEventHandler = (...args: readonly unknown[]) => void;

type WorkerInstance = {
  close: ReturnType<typeof vi.fn>;
  handlers: Map<string, WorkerEventHandler>;
  name: string;
  on: ReturnType<typeof vi.fn>;
  options: unknown;
  processor: (job: unknown) => Promise<void>;
};

type QueueInstance = {
  close: ReturnType<typeof vi.fn>;
  name: string;
  options: unknown;
};

type RedisInstance = {
  quit: ReturnType<typeof vi.fn>;
  url: string;
  options: unknown;
};

const mocks = vi.hoisted(() => {
  const queueInstances: QueueInstance[] = [];
  const redisInstances: RedisInstance[] = [];
  const workerInstances: WorkerInstance[] = [];

  const queueConstructor = vi.fn(function Queue(
    name: string,
    options: unknown
  ) {
    const instance = {
      close: vi.fn(async () => {}),
      name,
      options,
    };
    queueInstances.push(instance);
    return instance;
  });

  const redisConstructor = vi.fn(function IORedis(
    url: string,
    options: unknown
  ) {
    const instance = {
      options,
      quit: vi.fn(async () => {}),
      url,
    };
    redisInstances.push(instance);
    return instance;
  });

  const workerConstructor = vi.fn(function Worker(
    name: string,
    processor: (job: unknown) => Promise<void>,
    options: unknown
  ) {
    const handlers = new Map<string, WorkerEventHandler>();
    const instance: WorkerInstance = {
      close: vi.fn(async () => {}),
      handlers,
      name,
      on: vi.fn(),
      options,
      processor,
    };
    instance.on.mockImplementation(
      (event: string, handler: WorkerEventHandler) => {
        handlers.set(event, handler);
        return instance;
      }
    );
    workerInstances.push(instance);
    return instance;
  });

  return {
    loggerError: vi.fn(),
    loggerInfo: vi.fn(),
    loggerWarn: vi.fn(),
    processDefaultQueueJob: vi.fn(async () => {}),
    processNewsletterQueueJob: vi.fn(async () => {}),
    queueConstructor,
    queueInstances,
    reconcileCmsMediaProcessingJobs: vi.fn(async () => {}),
    redisConstructor,
    redisInstances,
    registerEventPaymentDailyNotificationScheduler: vi.fn(async () => {}),
    registerLegacyMysqlSyncScheduler: vi.fn(async () => {}),
    registerSailingCardAnnualClearingScheduler: vi.fn(async () => {}),
    workerConstructor,
    workerInstances,
  };
});

vi.mock('bullmq', () => ({
  Queue: mocks.queueConstructor,
  Worker: mocks.workerConstructor,
}));

vi.mock('ioredis', () => ({
  default: mocks.redisConstructor,
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
  },
}));

vi.mock('@/worker/cmsMediaProcessingJob', () => ({
  reconcileCmsMediaProcessingJobs: mocks.reconcileCmsMediaProcessingJobs,
}));

vi.mock('@/worker/defaultQueue', () => ({
  DEFAULT_QUEUE_NAME: 'default',
}));

vi.mock('@/worker/eventPaymentEmailJob', () => ({
  registerEventPaymentDailyNotificationScheduler:
    mocks.registerEventPaymentDailyNotificationScheduler,
}));

vi.mock('@/worker/legacyMysqlSyncJob', () => ({
  registerLegacyMysqlSyncScheduler: mocks.registerLegacyMysqlSyncScheduler,
}));

vi.mock('@/worker/sailingCardAnnualClearingJob', () => ({
  registerSailingCardAnnualClearingScheduler:
    mocks.registerSailingCardAnnualClearingScheduler,
}));

vi.mock('@/worker/workerDispatch', () => ({
  NEWSLETTER_QUEUE_NAME: 'newsletter',
  processDefaultQueueJob: mocks.processDefaultQueueJob,
  processNewsletterQueueJob: mocks.processNewsletterQueueJob,
}));

function callHandler(
  handler: WorkerEventHandler | undefined,
  ...args: readonly unknown[]
): void {
  if (!handler) {
    throw new Error('Expected worker event handler to be registered');
  }
  handler(...args);
}

function workerInstanceAt(index: number): WorkerInstance {
  const instance = mocks.workerInstances.at(index);
  if (!instance) {
    throw new Error(`Expected worker instance at index ${index}`);
  }
  return instance;
}

function firstQueueInstance(): QueueInstance {
  const instance = mocks.queueInstances.at(0);
  if (!instance) {
    throw new Error('Expected queue instance');
  }
  return instance;
}

function firstRedisInstance(): RedisInstance {
  const instance = mocks.redisInstances.at(0);
  if (!instance) {
    throw new Error('Expected redis instance');
  }
  return instance;
}

function firstCallOrder(mock: ReturnType<typeof vi.fn>): number {
  const order = mock.mock.invocationCallOrder.at(0);
  if (order === undefined) {
    throw new Error('Expected mock to be called');
  }
  return order;
}

describe('worker runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queueInstances.length = 0;
    mocks.redisInstances.length = 0;
    mocks.workerInstances.length = 0;
  });

  it('starts redis-backed workers with scheduler reconciliation', async () => {
    const { startWorkerRuntime } = await import('@/worker/workerRuntime');
    const now = new Date('2026-05-27T12:00:00.000Z');

    await startWorkerRuntime({
      newsletterWorkerConcurrency: 3,
      now,
      redisUrl: 'redis://localhost:6379',
    });

    const connection = firstRedisInstance();
    const queue = firstQueueInstance();

    expect(mocks.redisConstructor).toHaveBeenCalledWith(
      'redis://localhost:6379',
      { maxRetriesPerRequest: null }
    );
    expect(mocks.queueConstructor).toHaveBeenCalledWith('default', {
      connection,
    });
    expect(mocks.registerLegacyMysqlSyncScheduler).toHaveBeenCalledWith(queue);
    expect(
      mocks.registerEventPaymentDailyNotificationScheduler
    ).toHaveBeenCalledWith(queue);
    expect(
      mocks.registerSailingCardAnnualClearingScheduler
    ).toHaveBeenCalledWith(queue);
    expect(mocks.reconcileCmsMediaProcessingJobs).toHaveBeenCalledWith(
      queue,
      now
    );
    expect(mocks.workerConstructor).toHaveBeenNthCalledWith(
      1,
      'default',
      expect.any(Function),
      { concurrency: 1, connection }
    );
    expect(mocks.workerConstructor).toHaveBeenNthCalledWith(
      2,
      'newsletter',
      expect.any(Function),
      { concurrency: 3, connection }
    );
    expect(mocks.loggerInfo).toHaveBeenCalledWith('Newsletter worker started', {
      concurrency: 3,
    });
  });

  it('routes bullmq processors through dispatch functions', async () => {
    const { startWorkerRuntime } = await import('@/worker/workerRuntime');
    await startWorkerRuntime({
      newsletterWorkerConcurrency: 2,
      redisUrl: 'redis://localhost:6379',
    });
    const defaultWorker = workerInstanceAt(0);
    const newsletterWorker = workerInstanceAt(1);
    const queue = firstQueueInstance();
    const defaultJob = { data: { assetId: 'asset-1' }, name: 'cms-media' };
    const newsletterJob = { data: { broadcastId: 'broadcast-1' } };

    await defaultWorker.processor(defaultJob);
    await newsletterWorker.processor(newsletterJob);

    expect(mocks.processDefaultQueueJob).toHaveBeenCalledWith(
      defaultJob,
      queue
    );
    expect(mocks.processNewsletterQueueJob).toHaveBeenCalledWith(newsletterJob);
  });

  it('logs newsletter worker lifecycle events', async () => {
    const { startWorkerRuntime } = await import('@/worker/workerRuntime');
    await startWorkerRuntime({
      newsletterWorkerConcurrency: 2,
      redisUrl: 'redis://localhost:6379',
    });
    const newsletterWorker = workerInstanceAt(1);
    const error = new Error('send failed');

    callHandler(newsletterWorker.handlers.get('completed'), {
      data: { broadcastId: 'broadcast-1' },
      id: 'job-1',
    });
    callHandler(
      newsletterWorker.handlers.get('failed'),
      { data: { broadcastId: 'broadcast-2' }, id: 'job-2' },
      error
    );
    callHandler(newsletterWorker.handlers.get('error'), error);
    callHandler(newsletterWorker.handlers.get('stalled'), 'job-3');

    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      'Newsletter broadcast job completed',
      { broadcastId: 'broadcast-1', jobId: 'job-1' }
    );
    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Newsletter broadcast job failed: {error}',
      { broadcastId: 'broadcast-2', error, jobId: 'job-2' }
    );
    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Newsletter worker error: {error}',
      { error }
    );
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Newsletter broadcast job stalled',
      { jobId: 'job-3' }
    );
  });

  it('closes workers before queue and redis connection', async () => {
    const { startWorkerRuntime } = await import('@/worker/workerRuntime');
    const runtime = await startWorkerRuntime({
      newsletterWorkerConcurrency: 2,
      redisUrl: 'redis://localhost:6379',
    });
    const defaultWorker = workerInstanceAt(0);
    const newsletterWorker = workerInstanceAt(1);
    const queue = firstQueueInstance();
    const connection = firstRedisInstance();

    await runtime.close();

    expect(newsletterWorker.close).toHaveBeenCalledOnce();
    expect(defaultWorker.close).toHaveBeenCalledOnce();
    expect(queue.close).toHaveBeenCalledOnce();
    expect(connection.quit).toHaveBeenCalledOnce();
    expect(firstCallOrder(newsletterWorker.close)).toBeLessThan(
      firstCallOrder(defaultWorker.close)
    );
    expect(firstCallOrder(defaultWorker.close)).toBeLessThan(
      firstCallOrder(queue.close)
    );
    expect(firstCallOrder(queue.close)).toBeLessThan(
      firstCallOrder(connection.quit)
    );
  });
});
