import 'server-only';
import { getBaseUrl } from '@/utils/Helpers';

type NewsletterUrlParams = {
  listId: string;
  token: string;
};

function absoluteUrl(path: string): string {
  return `${getBaseUrl()}${path}`;
}

/**
 * Builds the public manage-preferences URL for a subscriber token.
 *
 * @param token - Raw manage token
 * @returns Absolute URL
 */
export function newsletterManageUrl(token: string): string {
  return absoluteUrl(`/newsletter/manage/?token=${encodeURIComponent(token)}`);
}

/**
 * Builds the one-click unsubscribe URL for a list-scoped token.
 *
 * @param params - Token and newsletter list id
 * @returns Absolute URL
 */
export function newsletterOneClickUnsubscribeUrl(
  params: NewsletterUrlParams
): string {
  const search = new URLSearchParams({
    list: params.listId,
    token: params.token,
  });
  return absoluteUrl(`/api/newsletter/unsubscribe/?${search.toString()}`);
}
