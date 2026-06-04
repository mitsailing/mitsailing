import 'server-only';
import { getBaseUrl } from '@/utils/Helpers';

type NewsletterUrlParams = {
  listId: string;
  token: string;
};

type NewsletterManageUrlOptions = {
  actionListId?: string;
  resubscribedListId?: string;
  unsubscribedListId?: string;
};

function absoluteUrl(path: string): string {
  return `${getBaseUrl().replace(/\/$/, '')}${path}`;
}

/**
 * Builds the public manage-preferences path for a subscriber token.
 *
 * @param token - Raw manage token
 * @param options - Optional one-list action state
 * @returns Site-relative path
 */
export function newsletterManagePath(
  token: string,
  options?: NewsletterManageUrlOptions
): string {
  const search = new URLSearchParams({ token });
  if (options?.actionListId) {
    search.set('action', 'unsubscribe');
    search.set('list', options.actionListId);
  }
  if (options?.unsubscribedListId) {
    search.set('unsubscribed', '1');
    search.set('list', options.unsubscribedListId);
  }
  if (options?.resubscribedListId) {
    search.set('resubscribed', '1');
    search.set('list', options.resubscribedListId);
  }
  return `/newsletter/manage?${search.toString()}`;
}

/**
 * Builds the public manage-preferences URL for a subscriber token.
 *
 * @param token - Raw manage token
 * @param options - Optional one-list action state
 * @returns Absolute URL
 */
export function newsletterManageUrl(
  token: string,
  options?: NewsletterManageUrlOptions
): string {
  return absoluteUrl(newsletterManagePath(token, options));
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
  return absoluteUrl(`/api/newsletter/unsubscribe?${search.toString()}`);
}
