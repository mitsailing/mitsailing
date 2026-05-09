/**
 * Helpers for comparing the current route to internal nav `href` values
 * (locale-free paths, optional `#` hash for class categories).
 */

/**
 * Extracts the part before a separator.
 *
 * @param value - String to split.
 * @param separator - Separator to find.
 * @returns The segment before the separator, or the original value.
 */
function segmentBefore(value: string, separator: string): string {
  const separatorIndex = value.indexOf(separator);
  if (separatorIndex === -1) {
    return value;
  }
  return value.slice(0, separatorIndex);
}

/**
 * Normalizes an app path for equality (ignore trailing slash except root, strip query).
 *
 * @param path - Raw path, possibly with query/hash.
 * @returns Path with stable `/` form for comparison.
 */
export function normalizeNavPath(path: string): string {
  const withoutQuery = segmentBefore(path, '?');
  const withoutHash = segmentBefore(withoutQuery, '#');
  let s = withoutHash.trim();
  if (s.length > 1 && s.endsWith('/')) {
    s = s.slice(0, -1);
  }
  return s.length === 0 ? '/' : s;
}

/**
 * Returns the hash segment of an `href`, or `undefined` if there is no `#`.
 *
 * @param href - Full href including optional `#fragment`.
 * @returns Decoded fragment or `undefined`.
 */
export function hashFromHref(href: string): string | undefined {
  const i = href.indexOf('#');
  if (i === -1) {
    return undefined;
  }
  return decodeURIComponent(href.slice(i + 1));
}

/**
 * Whether `href` should be treated as the current page for nav chrome
 * (`aria-current`, active styling).
 *
 * @param pathname - Locale-free pathname from the app router.
 * @param routeHash - `location.hash` without the leading `#`.
 * @param href - Nav target (internal path, optional `#`).
 * @returns Whether this link points at the current route.
 */
export function isNavLinkActive(
  pathname: string,
  routeHash: string,
  href: string
): boolean {
  const pathOnly = segmentBefore(href, '?');
  const pathPart = segmentBefore(pathOnly, '#');
  const normPath = normalizeNavPath(pathname);
  const normHrefPath = normalizeNavPath(pathPart);
  if (normPath !== normHrefPath) {
    return false;
  }
  const hashInHref = hashFromHref(href);
  if (hashInHref === undefined) {
    return routeHash === '';
  }
  return routeHash === hashInHref;
}
