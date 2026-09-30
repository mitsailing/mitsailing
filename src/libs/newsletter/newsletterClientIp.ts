import { isIP } from 'node:net';

const CLIENT_IP_HEADERS = [
  'x-real-ip',
  'cf-connecting-ip',
  'x-forwarded-for',
] as const;

function singleClientIp(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.includes(',') || isIP(trimmed) === 0) {
    return null;
  }
  return trimmed;
}

/**
 * Returns one client IP from headers the ingress has already replaced.
 *
 * @param headerList - Request headers
 * @returns Normalized client IP, or null when every candidate is missing or a forwarded chain
 */
export function trustedClientIp(headerList: {
  get(name: string): string | null;
}): string | null {
  for (const name of CLIENT_IP_HEADERS) {
    const ip = singleClientIp(headerList.get(name));
    if (ip) {
      return ip;
    }
  }
  return null;
}
