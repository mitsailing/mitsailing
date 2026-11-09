import { Env } from '@/libs/Env';

/**
 * Public site origin without a trailing slash.
 *
 * @returns `NEXT_PUBLIC_APP_URL` used for live preview and preview links
 */
export function appOrigin(): string {
  return Env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
}
