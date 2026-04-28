import 'server-only';
import { signJWT, verifyJWT } from 'better-auth/crypto';
import { Env } from '@/libs/Env';

/**
 * Signed-token surface for the "Unlock account" email link. Devise Lockable
 * parity: the token binds the email address to an intent and an expiry so a
 * stolen URL cannot be replayed after the window or retargeted at another
 * account. We reuse `BETTER_AUTH_SECRET` so there is one rotation lever.
 */
const UNLOCK_ACTION = 'unlock-account';
/** 1 hour — matches the email-verification token window. */
const EXPIRES_IN = 60 * 60;

type UnlockPayload = {
  email: string;
  action: string;
};

/**
 * Produce a signed, short-lived unlock token embedded in the account-locked
 * email URL.
 *
 * @param email - Lowercased account email this token unlocks.
 * @returns Compact JWT safe to place in a URL query string.
 */
export async function createUnlockAccountToken(email: string): Promise<string> {
  const token = await signJWT(
    { email: email.toLowerCase(), action: UNLOCK_ACTION },
    Env.BETTER_AUTH_SECRET,
    EXPIRES_IN
  );
  return token;
}

/**
 * Verify a token minted by {@link createUnlockAccountToken}. Returns `null`
 * for any failure (tampering, wrong action, expired) so callers never branch
 * on error shape.
 *
 * @param token - Raw token string from the unlock URL.
 * @returns The bound email on success, otherwise `null`.
 */
export async function verifyUnlockAccountToken(
  token: string
): Promise<{ email: string } | null> {
  try {
    const payload = await verifyJWT<Partial<UnlockPayload>>(
      token,
      Env.BETTER_AUTH_SECRET
    );
    if (
      !payload ||
      payload.action !== UNLOCK_ACTION ||
      typeof payload.email !== 'string' ||
      payload.email.length === 0
    ) {
      return null;
    }
    return { email: payload.email };
  } catch {
    return null;
  }
}
