import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '@/libs/Logger';
import type { NewsletterBroadcastJob } from '@/libs/newsletter/newsletterQueue';
import { reconcileCmsMediaProcessingJobs } from '@/worker/cmsMediaProcessingJob';
import { DEFAULT_QUEUE_NAME } from '@/worker/defaultQueue';
import { registerEventPaymentDailyNotificationScheduler } from '@/worker/eventPaymentEmailJob';
import { registerLegacyMysqlSyncScheduler } from '@/worker/legacyMysqlSyncJob';
import { registerSailingCardAnnualClearingScheduler } from '@/worker/sailingCardAnnualClearingJob';
import {
  NEWSLETTER_QUEUE_NAME,
  processDefaultQueueJob,
  processNewsletterQueueJob,
} from '@/worker/workerDispatch';

type WorkerRuntimeOptions = {
  newsletterWorkerConcurrency: number;
  now?: Date;
  redisUrl: string;
};

export type WorkerRuntime = {
  close: () => Promise<void>;
};

export async function startWorkerRuntime(
  options: WorkerRuntimeOptions
): Promise<WorkerRuntime> {
  const connection = new IORedis(options.redisUrl, {
    maxRetriesPerRequest: null,
  });
  const queue = new Queue(DEFAULT_QUEUE_NAME, { connection });

  try {
    await registerLegacyMysqlSyncScheduler(queue);
    await registerEventPaymentDailyNotificationScheduler(queue);
    await registerSailingCardAnnualClearingScheduler(queue);
    await reconcileCmsMediaProcessingJobs(queue, options.now ?? new Date());
  } catch (error) {
    await queue.close();
    await connection.quit();
    throw error;
  }

  const worker = new Worker(
    DEFAULT_QUEUE_NAME,
    async (job) => {
      await processDefaultQueueJob(job, queue);
    },
    { connection, concurrency: 1 }
  );

  const newsletterWorker = new Worker<NewsletterBroadcastJob>(
    NEWSLETTER_QUEUE_NAME,
    async (job) => {
      await processNewsletterQueueJob(job);
    },
    {
      connection,
      concurrency: options.newsletterWorkerConcurrency,
    }
  );

  logger.info('Newsletter worker started', {
    concurrency: options.newsletterWorkerConcurrency,
  });

  newsletterWorker.on('completed', (job) => {
    logger.info('Newsletter broadcast job completed', {
      broadcastId: job.data.broadcastId,
      jobId: job.id,
    });
  });
  newsletterWorker.on('failed', (job, error) => {
    logger.error('Newsletter broadcast job failed: {error}', {
      broadcastId: job?.data.broadcastId,
      error,
      jobId: job?.id,
    });
  });
  newsletterWorker.on('error', (error) => {
    logger.error('Newsletter worker error: {error}', { error });
  });
  newsletterWorker.on('stalled', (jobId) => {
    logger.warn('Newsletter broadcast job stalled', { jobId });
  });

  return {
    close: async () => {
      await newsletterWorker.close();
      await worker.close();
      await queue.close();
      await connection.quit();
    },
  };
}
