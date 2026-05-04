const MAX_LEN = 200;

/**
 * Normalizes an {@code Idempotency-Key} header value for upload POST dedupe.
 *
 * @param raw - Raw header string or null
 * @returns Trimmed key or null when absent/invalid
 */
export function normalizeUploadIdempotencyKey(
  raw: string | null
): string | null {
  if (raw === null) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_LEN) {
    return null;
  }
  return trimmed;
}
