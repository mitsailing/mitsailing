import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { processNewsletterBroadcast } from '@/libs/newsletter/newsletterBroadcasts';
import { NEWSLETTER_QUEUE_NAME } from '@/libs/newsletter/newsletterConstants';
import type { NewsletterBroadcastJob } from '@/libs/newsletter/newsletterQueue';

function main(): void {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required for the BullMQ worker');
  }

  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<NewsletterBroadcastJob>(
    NEWSLETTER_QUEUE_NAME,
    async (job) => {
      await processNewsletterBroadcast(job.data.broadcastId);
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
