import 'server-only';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { Env } from '@/libs/Env';
import { NEWSLETTER_QUEUE_NAME } from '@/libs/newsletter/newsletterConstants';

export type NewsletterBroadcastJob = {
  broadcastId: string;
};

export type EnqueueNewsletterBroadcastResult =
  | { ok: true }
  | { ok: false; error: 'enqueue_failed' | 'redis_unavailable' };

/**
 * Enqueues a broadcast send job for the worker process.
 *
 * @param broadcastId - Newsletter broadcast id
 * @returns Queue result or configuration error
 */
export async function enqueueNewsletterBroadcast(
  broadcastId: string
): Promise<EnqueueNewsletterBroadcastResult> {
  if (!Env.REDIS_URL) {
    return { ok: false, error: 'redis_unavailable' };
  }

  const connection = new IORedis(Env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  const queue = new Queue<NewsletterBroadcastJob>(NEWSLETTER_QUEUE_NAME, {
    connection,
  });
  try {
    await queue.add(
      'send-broadcast',
      { broadcastId },
      {
        attempts: 3,
        jobId: `newsletter-broadcast:${broadcastId}`,
        removeOnComplete: 100,
        removeOnFail: 500,
      }
    );
  } catch {
    return { ok: false, error: 'enqueue_failed' };
  } finally {
    await queue.close();
    await connection.quit();
  }

  return { ok: true };
}
