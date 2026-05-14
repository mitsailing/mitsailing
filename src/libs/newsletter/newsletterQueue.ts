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

type EnqueueNewsletterBroadcastParams = {
  broadcastId: string;
  continuationKey?: string;
  scheduledAt?: Date | null;
};

export type EnqueueNewsletterBroadcastResult =
  | { ok: true }
  | { ok: false; error: 'enqueue_failed' | 'redis_unavailable' };

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

  const connection = new IORedis(Env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  const queue = new Queue<NewsletterBroadcastJob>(NEWSLETTER_QUEUE_NAME, {
    connection,
  });
  try {
    await queue.add(
      'send-broadcast',
      {
        broadcastId: enqueueParams.broadcastId,
        ...(scheduledAt ? { scheduledAt: scheduledAt.toISOString() } : {}),
      },
      {
        attempts: 3,
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
  } finally {
    const cleanupResults = await Promise.allSettled([
      queue.close(),
      connection.quit(),
    ]);
    for (const [index, result] of cleanupResults.entries()) {
      if (result.status === 'fulfilled') {
        continue;
      }
      const resource = index === 0 ? 'queue' : 'redis';
      logger.error('Failed to close newsletter queue resource: {error}', {
        broadcastId: enqueueParams.broadcastId,
        error: result.reason,
        resource,
      });
    }
  }

  return { ok: true };
}
