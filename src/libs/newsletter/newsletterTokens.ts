import 'server-only';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { Env } from '@/libs/Env';
import { NEWSLETTER_MANAGE_TOKEN_BYTES } from '@/libs/newsletter/newsletterConstants';

export type NewsletterTokenPair = {
  token: string;
  hash: string;
};

/**
 * Hashes a newsletter manage token before database storage.
 *
 * @param token - Raw token from a private email link
 * @returns Stable SHA-256 hex digest
 */
function hashNewsletterToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Creates an opaque token for subscriber preference management.
 *
 * @returns Raw token plus database hash
 */
export function createNewsletterTokenPair(): NewsletterTokenPair {
  const token = randomBytes(NEWSLETTER_MANAGE_TOKEN_BYTES).toString(
    'base64url'
  );
  return { token, hash: hashNewsletterToken(token) };
}

function tokenSignature(subscriberId: string, manageTokenHash: string): string {
  return createHmac('sha256', Env.BETTER_AUTH_SECRET)
    .update(`${subscriberId}:${manageTokenHash}`)
    .digest('base64url');
}

/**
 * Builds a tokenized manage-link value from a subscriber row.
 *
 * @param subscriberId - Subscriber id
 * @param manageTokenHash - Stored per-subscriber random token hash
 * @returns Raw token safe for email URLs
 */
export function buildNewsletterManageToken(
  subscriberId: string,
  manageTokenHash: string
): string {
  return `${subscriberId}.${tokenSignature(subscriberId, manageTokenHash)}`;
}

/**
 * Verifies a token against the stored hash for its subscriber id.
 *
 * @param token - Raw token from a link
 * @param manageTokenHash - Stored per-subscriber random token hash
 * @returns Subscriber id when the signature is valid
 */
export function verifyNewsletterManageToken(
  token: string,
  manageTokenHash: string
): string | null {
  const separatorIndex = token.lastIndexOf('.');
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
    return null;
  }
  const subscriberId = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expected = tokenSignature(subscriberId, manageTokenHash);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) {
    return null;
  }
  return timingSafeEqual(expectedBuffer, signatureBuffer) ? subscriberId : null;
}
