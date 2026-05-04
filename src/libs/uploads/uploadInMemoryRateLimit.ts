/** Sliding window length for per-admin upload POST throttling (ms). */
const WINDOW_MS = 60_000;

/** Max POSTs per window per admin when Arcjet is not configured. */
const MAX_PER_WINDOW_WITHOUT_ARCJET = 90;

/** Max POSTs per window per admin when Arcjet is configured (belt-and-suspenders). */
const MAX_PER_WINDOW_WITH_ARCJET = 200;

const hits = new Map<string, number[]>();

function prune(now: number, stamps: number[]): number[] {
  const cutoff = now - WINDOW_MS;
  const next: number[] = [];
  for (const t of stamps) {
    if (t >= cutoff) {
      next.push(t);
    }
  }
  return next;
}

/**
 * In-process sliding-window limiter for {@code POST /api/admin/uploads}. Fails
 * closed per key only in this process (fine for single-node {@code next start}).
 *
 * @param userId - Authenticated admin id
 * @param arcjetActive - When true, use a higher ceiling so Arcjet remains primary
 * @returns Seconds until the oldest hit ages out, or 0 if allowed
 */
export function inMemoryUploadPostRateLimit(
  userId: string,
  arcjetActive: boolean
): { allowed: true } | { allowed: false; retryAfterSec: number } {
  const max = arcjetActive
    ? MAX_PER_WINDOW_WITH_ARCJET
    : MAX_PER_WINDOW_WITHOUT_ARCJET;
  const now = Date.now();
  const prev = hits.get(userId) ?? [];
  const stamps = prune(now, prev);

  if (stamps.length >= max) {
    const [oldest] = stamps;
    if (oldest === undefined) {
      return { allowed: true };
    }
    const retryAfterMs = WINDOW_MS - (now - oldest);
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return { allowed: false, retryAfterSec };
  }

  stamps.push(now);
  hits.set(userId, stamps);
  return { allowed: true };
}
