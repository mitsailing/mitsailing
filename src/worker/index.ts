import type { Job } from 'bullmq';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';
import { DEFAULT_QUEUE_NAME } from '@/worker/defaultQueue';
import {
  LEGACY_MYSQL_SYNC_JOB_NAME,
  processLegacyMysqlSyncJob,
  registerLegacyMysqlSyncScheduler,
} from '@/worker/legacyMysqlSyncJob';
import {
  PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME,
  processPavilionReservationSubmittedEmailJob,
} from '@/worker/pavilionReservationSubmittedEmailJob';

async function processJob(
  job: Pick<Job<unknown>, 'data' | 'name'>
): Promise<void> {
  if (job.name === LEGACY_MYSQL_SYNC_JOB_NAME) {
    await processLegacyMysqlSyncJob();
    return;
  }
  if (job.name === PAVILION_RESERVATION_SUBMITTED_EMAIL_JOB_NAME) {
    await processPavilionReservationSubmittedEmailJob(job.data);
    return;
  }
  throw new Error(`Unknown worker job: ${job.name}`);
}

function logWorkerLifecycleFailure(options: {
  context: 'shutdown' | 'startup';
  error: unknown;
}): void {
  logger.error(
    '[worker:{context}] worker {context} failed error_name={errorName} error_code={errorCode}',
    {
      context: options.context,
      errorCode: safeErrorCode(options.error) ?? 'unknown',
      errorName: safeErrorName(options.error),
    }
  );
}

async function main(): Promise<void> {
  const redisUrl = Env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required for the BullMQ worker');
  }

  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  const queue = new Queue(DEFAULT_QUEUE_NAME, { connection });
  await registerLegacyMysqlSyncScheduler(queue);

  const worker = new Worker(
    DEFAULT_QUEUE_NAME,
    async (job) => {
      await processJob(job);
    },
    { connection, concurrency: 1 }
  );

  const shutdown = async (): Promise<void> => {
    await worker.close();
    await queue.close();
    await connection.quit();
    process.exit(0);
  };

  const handleSignal = async (): Promise<void> => {
    try {
      await shutdown();
    } catch (error: unknown) {
      logWorkerLifecycleFailure({ context: 'shutdown', error });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    handleSignal();
  });
  process.on('SIGINT', () => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    handleSignal();
  });
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error: unknown) {
    logWorkerLifecycleFailure({ context: 'startup', error });
    process.exit(1);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run();
