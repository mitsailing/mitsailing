import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';

export const DEFAULT_QUEUE_NAME = 'default';

let cachedConnection: IORedis | null = null;
let cachedQueue: Queue | null = null;

function getDefaultQueueConnection(): IORedis {
  if (cachedConnection) {
    return cachedConnection;
  }
  if (!Env.REDIS_URL) {
    throw new Error('REDIS_URL is required to enqueue background jobs');
  }
  cachedConnection = new IORedis(Env.REDIS_URL, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });
  return cachedConnection;
}

export function getDefaultQueue(): Queue {
  if (cachedQueue) {
    return cachedQueue;
  }
  cachedQueue = new Queue(DEFAULT_QUEUE_NAME, {
    connection: getDefaultQueueConnection(),
  });
  cachedQueue.on('error', (error) => {
    logger.error('Default queue error: {error}', { error });
  });
  return cachedQueue;
}
