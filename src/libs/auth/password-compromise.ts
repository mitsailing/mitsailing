import 'server-only';
import { createHash } from 'node:crypto';
import { APIError } from 'better-auth/api';
import { Env } from '@/libs/Env';
import enMessages from '@/locales/en.json';

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const HIBP_USER_AGENT = 'BetterAuth Password Checker';

export const passwordCompromiseCheckEnabled =
  Env.NODE_ENV !== 'test' && Env.NEXT_PUBLIC_IS_E2E !== '1';

export async function assertPasswordNotCompromised(password: string) {
  if (!passwordCompromiseCheckEnabled) {
    return;
  }

  const sha1Hash = createHash('sha1')
    .update(password)
    .digest('hex')
    .toUpperCase();
  const prefix = sha1Hash.slice(0, 5);
  const suffix = sha1Hash.slice(5);

  try {
    const response = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      headers: {
        'Add-Padding': 'true',
        'User-Agent': HIBP_USER_AGENT,
      },
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

    throw new APIError('INTERNAL_SERVER_ERROR', {
      message: 'Failed to check password. Please try again later.',
    });
  }
}
