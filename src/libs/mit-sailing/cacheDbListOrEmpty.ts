import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import { logger } from '@/libs/Logger';

type CacheDbListOrEmptyOptions = {
  keyParts: string[];
  revalidate?: number | false;
  tags: string[];
};

/**
 * React `cache()` wrapper for server loads that should soft-fail with `[]`.
 * Dedupes per request only (same semantics as other `cache()` usages here).
 *
 * @param logContext - Short label for structured logs (!= user-facing copy)
 * @param loadUnchecked - Underlying fetch (rejections become empty-list return)
 * @param options - Optional persistent Next data cache key and tag settings
 * @returns Request-cached loader that resolves to rows or `[]` on failure
 */
export function cacheDbListOrEmpty<T>(
  logContext: string,
  loadUnchecked: () => Promise<T[]>,
  options?: CacheDbListOrEmptyOptions
) {
  const load = options
    ? unstable_cache(loadUnchecked, options.keyParts, {
        revalidate: options.revalidate,
        tags: options.tags,
      })
    : loadUnchecked;

  return cache(async (): Promise<T[]> => {
    try {
      return await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load ${logContext}: ${message}`);
      return [];
    }
  });
}
