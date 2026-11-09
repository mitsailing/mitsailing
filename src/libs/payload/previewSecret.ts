import { createHmac, timingSafeEqual } from 'node:crypto';
import { Env } from '@/libs/Env';

/**
 * Preview-route secret derived from `PAYLOAD_SECRET`.
 *
 * The raw CMS secret stays out of preview URLs. Callers still have to be signed in.
 *
 * @returns Hex HMAC used as `previewSecret`
 */
export function payloadPreviewSecret(): string {
  return createHmac('sha256', Env.PAYLOAD_SECRET)
    .update('payload-page-preview')
    .digest('hex');
}

/**
 * Compares a preview query secret to {@link payloadPreviewSecret}.
 *
 * @param value - `previewSecret` query param
 * @returns Whether the secret matches
 */
export function payloadPreviewSecretMatches(value: null | string): boolean {
  if (!value) {
    return false;
  }
  const expected = Buffer.from(payloadPreviewSecret());
  const received = Buffer.from(value);
  if (expected.length !== received.length) {
    return false;
  }
  return timingSafeEqual(expected, received);
}
