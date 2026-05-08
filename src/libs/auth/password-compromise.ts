import 'server-only';
import { createHash } from 'node:crypto';
import { APIError } from 'better-auth/api';
import { Env } from '@/libs/Env';
import enMessages from '@/locales/en.json';

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const HIBP_TIMEOUT_MS = 5000;
const HIBP_USER_AGENT = 'BetterAuth Password Checker';

export const passwordCompromiseCheckEnabled =
  Env.NODE_ENV !== 'test' && Env.NEXT_PUBLIC_IS_E2E !== '1';

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error || error instanceof DOMException) &&
    error.name === 'AbortError'
  );
}

/**
 * Computes the SHA-1 hex split required by the Pwned Passwords (range) API for
 * k-anonymity lookups. This is **not** password storage — the upstream service
 * protocol mandates SHA-1 for prefix/suffix matching.
 *
 * @param password - Cleartext password for the one-way range lookup only.
 * @returns The SHA-1 prefix and suffix for a range API request.
 * @see {@link https://haveibeenpwned.com/API/v3#PwnedPasswords HIBP Pwned Passwords}
 */
export function hibpPasswordSha1RangeParts(password: string): {
  prefix: string;
  suffix: string;
} {
  // Not password storage: Pwned Passwords range API requires SHA-1 for k-anonymity.
  const sha1Hasher = createHash('sha1');

  // codeql[js/insufficient-password-hash]
  const sha1Hash = sha1Hasher.update(password).digest('hex').toUpperCase();
  return {
    prefix: sha1Hash.slice(0, 5),
    suffix: sha1Hash.slice(5),
  };
}

export async function assertPasswordNotCompromised(password: string) {
  if (!passwordCompromiseCheckEnabled) {
    return;
  }

  const { prefix, suffix } = hibpPasswordSha1RangeParts(password);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, HIBP_TIMEOUT_MS);
    const response = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      headers: {
        'Add-Padding': 'true',
        'User-Agent': HIBP_USER_AGENT,
      },
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeout);
    });

    if (!response.ok) {
      throw new APIError('INTERNAL_SERVER_ERROR', {
        message: `Failed to check password. Status: ${response.status}`,
      });
    }

    const rangeBody = await response.text();
    const compromised = rangeBody
      .split('\n')
      .some((line) => line.split(':')[0]?.toUpperCase() === suffix);

    if (compromised) {
      throw APIError.from('BAD_REQUEST', {
        code: 'PASSWORD_COMPROMISED',
        message: enMessages.AuthErrors.PASSWORD_COMPROMISED,
      });
    }
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    if (isAbortError(error)) {
      return;
    }

    throw new APIError('INTERNAL_SERVER_ERROR', {
      message: 'Failed to check password. Please try again later.',
    });
  }
}
