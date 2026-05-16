import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { Env } from '@/libs/Env';
import {
  LEGACY_MYSQL_SYNC_JOB_NAME,
  processLegacyMysqlSyncJob,
  registerLegacyMysqlSyncScheduler,
} from '@/worker/legacyMysqlSyncJob';

async function processJob(name: string): Promise<void> {
  if (name === LEGACY_MYSQL_SYNC_JOB_NAME) {
    await processLegacyMysqlSyncJob();
    return;
  }
  throw new Error(`Unknown worker job: ${name}`);
}

async function main(): Promise<void> {
  const redisUrl = Env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required for the BullMQ worker');
  }

  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  const queue = new Queue('default', { connection });
  await registerLegacyMysqlSyncScheduler(queue);

  const worker = new Worker(
    'default',
    async (job) => {
      await processJob(job.name);
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
      console.error(error);
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
    console.error(error);
    process.exit(1);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run();
