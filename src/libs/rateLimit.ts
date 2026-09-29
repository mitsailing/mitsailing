import 'server-only';
import IORedis from 'ioredis';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';

export type RateLimitDecision = {
  rateLimited: boolean;
};

export type CheckRateLimitOptions = {
  durationSeconds: number;
  key: string;
  points: number;
  prefix: string;
};

/** Public newsletter signup: 5 attempts per 10 minutes per client key. */
export const newsletterSignupRateLimit = {
  durationSeconds: 600,
  points: 5,
  prefix: 'newsletter-signup',
} as const;

type SharedLimiter = RateLimiterMemory | RateLimiterRedis;

const limiters = new Map<string, SharedLimiter>();
let redisClient: IORedis | null = null;

function sharedRedis(): IORedis | null {
  if (!Env.REDIS_URL) {
    return null;
  }
  if (!redisClient) {
    redisClient = new IORedis(Env.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    redisClient.on('error', (error: Error) => {
      logger.error('Rate limit Redis error: {error}', { error });
    });
  }
  return redisClient;
}

function sharedLimiter(options: {
  durationSeconds: number;
  points: number;
  prefix: string;
}): SharedLimiter {
  const redis = sharedRedis();
  const store = redis ? 'redis' : 'memory';
  const cacheKey = `${store}:${options.prefix}:${options.points}:${options.durationSeconds}`;
  const existing = limiters.get(cacheKey);
  if (existing) {
    return existing;
  }
  const limiter = redis
    ? new RateLimiterRedis({
        duration: options.durationSeconds,
        keyPrefix: options.prefix,
        points: options.points,
        storeClient: redis,
      })
    : new RateLimiterMemory({
        duration: options.durationSeconds,
        keyPrefix: options.prefix,
        points: options.points,
      });
  limiters.set(cacheKey, limiter);
  return limiter;
}

/**
 * Consumes one point from the shared Redis window when Redis is configured.
 * Uses this process's memory when REDIS_URL is unset.
 *
 * @param options - Limiter identity, window, and client key
 * @returns Whether the caller is over the limit
 */
export async function checkRateLimit(
  options: CheckRateLimitOptions
): Promise<RateLimitDecision> {
  if (Env.IS_E2E === '1') {
    return { rateLimited: false };
  }

  try {
    await sharedLimiter(options).consume(options.key);
    return { rateLimited: false };
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Rate limit check failed open: {error}', { error });
      return { rateLimited: false };
    }
    return { rateLimited: true };
  }
}
