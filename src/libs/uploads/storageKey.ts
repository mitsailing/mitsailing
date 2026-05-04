const STORAGE_KEY_RE =
  /^\d{4}\/(0[1-9]|1[0-2])\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|gif|webp|pdf|mp4|webm)$/i;

/**
 * Builds a POSIX storage key `yyyy/mm/<uuid>.<ext>` (no leading slash).
 *
 * @param year - Four-digit UTC year
 * @param month - UTC month (1–12)
 * @param id - File stem (expected UUID)
 * @param extWithDot - Lowercase extension including the dot
 * @returns Storage key using forward slashes
 */
export function buildStorageKey(
  year: number,
  month: number,
  id: string,
  extWithDot: string
): string {
  const y = String(year);
  const m = String(month).padStart(2, '0');
  return `${y}/${m}/${id}${extWithDot}`;
}

/**
 * Validates catch-all path segments form an allowed storage key.
 *
 * @param segments - URL path segments after `/api/uploads/`
 * @returns Normalized storage key or `null` when invalid
 */
export function pathSegmentsToStorageKey(segments: string[]): string | null {
  if (segments.length === 0) {
    return null;
  }
  const decoded: string[] = [];
  for (const raw of segments) {
    try {
      decoded.push(decodeURIComponent(raw));
    } catch {
      return null;
    }
  }
  const joined = decoded.join('/');
  if (
    joined.includes('..') ||
    joined.startsWith('/') ||
    joined.includes('\\')
  ) {
    return null;
  }
  return STORAGE_KEY_RE.test(joined) ? joined : null;
}
