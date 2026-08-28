import 'server-only';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { NEWSLETTER_QUEUE_NAME } from '@/libs/newsletter/newsletterConstants';

export type NewsletterBroadcastJob = {
  broadcastId: string;
  scheduledAt?: string;
};

const NEWSLETTER_QUEUE_BACKOFF_MS = 30_000;

type EnqueueNewsletterBroadcastParams = {
  broadcastId: string;
  continuationKey?: string;
  scheduledAt?: Date | null;
};

export type EnqueueNewsletterBroadcastResult =
  | { ok: true }
  | { ok: false; error: 'enqueue_failed' | 'redis_unavailable' };

let cachedConnection: IORedis | null = null;
let cachedQueue: Queue<NewsletterBroadcastJob> | null = null;

function getNewsletterQueueConnection(redisUrl: string): IORedis {
  if (cachedConnection) {
    return cachedConnection;
  }
  cachedConnection = new IORedis(redisUrl, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });
  return cachedConnection;
}

function getNewsletterQueue(redisUrl: string): Queue<NewsletterBroadcastJob> {
  if (cachedQueue) {
    return cachedQueue;
  }
  cachedQueue = new Queue<NewsletterBroadcastJob>(NEWSLETTER_QUEUE_NAME, {
    connection: getNewsletterQueueConnection(redisUrl),
  });
  cachedQueue.on('error', (error) => {
    logger.error('Newsletter queue error: {error}', { error });
  });
  return cachedQueue;
}

/**
 * Enqueues a broadcast send job for the worker process.
 *
 * @param params - Newsletter broadcast id or enqueue options
 * @returns Queue result or configuration error
 */
export async function enqueueNewsletterBroadcast(
  params: EnqueueNewsletterBroadcastParams | string
): Promise<EnqueueNewsletterBroadcastResult> {
  if (!Env.REDIS_URL) {
    logger.error(
      'Newsletter broadcast enqueue unavailable: Redis is not configured'
    );
    return { ok: false, error: 'redis_unavailable' };
  }

  const enqueueParams =
    typeof params === 'string' ? { broadcastId: params } : params;
  const scheduledAt = enqueueParams.scheduledAt ?? null;
  const delay = scheduledAt
    ? Math.max(0, scheduledAt.getTime() - Date.now())
    : 0;
  const scheduleKey = scheduledAt ? scheduledAt.getTime() : 'now';
  const continuationKey = enqueueParams.continuationKey ?? 'initial';

  const queue = getNewsletterQueue(Env.REDIS_URL);
  try {
    await queue.add(
      'send-broadcast',
      {
        broadcastId: enqueueParams.broadcastId,
        ...(scheduledAt ? { scheduledAt: scheduledAt.toISOString() } : {}),
      },
      {
        attempts: 3,
        backoff: { delay: NEWSLETTER_QUEUE_BACKOFF_MS, type: 'exponential' },
        delay,
        jobId: `newsletter-broadcast:${enqueueParams.broadcastId}:${scheduleKey}:${continuationKey}`,
        removeOnComplete: 100,
        removeOnFail: 500,
      }
    );
  } catch (error) {
    logger.error('Failed to enqueue newsletter broadcast: {error}', {
      broadcastId: enqueueParams.broadcastId,
      error,
    });
    return { ok: false, error: 'enqueue_failed' };
  }

  return { ok: true };
}
