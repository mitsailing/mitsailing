const authCallbackParam = 'callbackUrl';

const fallbackCallbackUrl = '/';

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint < 32 || codePoint === 127)) {
      return true;
    }
  }
  return false;
}

function isSafeAppPath(value: string): boolean {
  return (
    value === '' ||
    (value.startsWith('/') &&
      !value.startsWith('//') &&
      !value.includes('\\') &&
      !hasControlCharacter(value))
  );
}

/**
 * Keeps auth redirects on this app. Accepts only app-relative paths and
 * rejects protocol-relative URLs such as `//example.com`.
 *
 * @param value - Candidate callback URL from user-controlled input.
 * @param fallback - Safe app-relative fallback.
 * @returns A safe app-relative callback path.
 */
export function safeAuthCallbackUrl(
  value: string | null | undefined,
  fallback: string = fallbackCallbackUrl
): string {
  const safeFallback = isSafeAppPath(fallback) ? fallback : fallbackCallbackUrl;

  if (!value) {
    return safeFallback;
  }

  const candidate = value.trim();
  if (!candidate) {
    return safeFallback;
  }
  if (!isSafeAppPath(candidate)) {
    return safeFallback;
  }

  return candidate;
}

/**
 * Adds a safe callback URL to an app-relative auth href.
 *
 * @param href - App-relative auth href.
 * @param callbackUrl - Candidate callback URL to preserve.
 * @returns Auth href with `callbackUrl` when one is available.
 */
export function authHrefWithCallback(
  href: string,
  callbackUrl: string | null | undefined
): string {
  if (!callbackUrl || href === '' || !isSafeAppPath(href)) {
    return href;
  }

  const safeCallback = safeAuthCallbackUrl(callbackUrl, '');
  if (!safeCallback) {
    return href;
  }

  const url = new URL(href, 'http://app.local');
  url.searchParams.set(authCallbackParam, safeCallback);
  return `${url.pathname}${url.search}${url.hash}`;
}
