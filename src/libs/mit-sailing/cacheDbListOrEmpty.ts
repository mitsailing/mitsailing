import { cache } from 'react';
import { logger } from '@/libs/Logger';

/**
 * React `cache()` wrapper for server loads that should soft-fail with `[]`.
 * Dedupes per request only (same semantics as other `cache()` usages here).
 *
 * @param logContext - Short label for structured logs (!= user-facing copy)
 * @param loadUnchecked - Underlying fetch (rejections become empty-list return)
 * @returns Request-cached loader that resolves to rows or `[]` on failure
 */
export function cacheDbListOrEmpty<T>(
  logContext: string,
  loadUnchecked: () => Promise<T[]>
) {
  return cache(async (): Promise<T[]> => {
    try {
      return await loadUnchecked();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load ${logContext}: ${message}`);
      return [];
    }
  });
}
