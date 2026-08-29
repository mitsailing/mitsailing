import 'server-only';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Env } from '@/libs/Env';

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

const limiters = new Map<string, RateLimiterMemory>();

function memoryLimiter(options: {
  durationSeconds: number;
  points: number;
  prefix: string;
}): RateLimiterMemory {
  const cacheKey = `${options.prefix}:${options.points}:${options.durationSeconds}`;
  const existing = limiters.get(cacheKey);
  if (existing) {
    return existing;
  }
  const limiter = new RateLimiterMemory({
    duration: options.durationSeconds,
    keyPrefix: options.prefix,
    points: options.points,
  });
  limiters.set(cacheKey, limiter);
  return limiter;
}

/**
 * Consumes one point for an in-process fixed window (long-lived Node, not Edge).
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
    await memoryLimiter(options).consume(options.key);
    return { rateLimited: false };
  } catch (error) {
    if (error instanceof Error) {
      return { rateLimited: false };
    }
    return { rateLimited: true };
  }
}
