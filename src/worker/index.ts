import { Worker } from 'bullmq';
import IORedis from 'ioredis';

function main(): void {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required for the BullMQ worker');
  }

  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker(
    'default',
    async () => {
      // Domain processors (email, sync, etc.) register here.
    },
    { connection, concurrency: 2 }
  );

  const shutdown = async (): Promise<void> => {
    await worker.close();
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
    // Node signal listeners must be synchronous; run async shutdown aside.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    handleSignal();
  });
  process.on('SIGINT', () => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    handleSignal();
  });
}

try {
  main();
} catch (error: unknown) {
  console.error(error);
  process.exit(1);
}
