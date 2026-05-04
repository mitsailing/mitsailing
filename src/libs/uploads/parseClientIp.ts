type HeaderGet = { get(name: string): string | null };

/**
 * Best-effort client IP for audit logs (tunnel / reverse proxy headers).
 *
 * @param headers - Incoming request headers
 * @returns First public-ish IP string or null
 */
export function parseClientIp(headers: HeaderGet): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }
  const realIp = headers.get('x-real-ip')?.trim();
  return realIp ?? null;
}
