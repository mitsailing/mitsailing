const SAFE_CMS_HREF_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/** Absolute links allowed for CMS menu items (paths validated via {@link isSafeCmsAppPath}). */
const SAFE_CMS_MENU_ITEM_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function pathPartEndIndex(value: string): number {
  const queryIndex = value.indexOf('?');
  const fragmentIndex = value.indexOf('#');
  if (queryIndex === -1) {
    return fragmentIndex === -1 ? value.length : fragmentIndex;
  }
  if (fragmentIndex === -1) {
    return queryIndex;
  }
  return Math.min(queryIndex, fragmentIndex);
}

function decodedPathSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function cmsHrefHasAsciiControlOrDelete(href: string): boolean {
  for (const unit of href) {
    const c = unit.codePointAt(0);
    if (c !== undefined && (c <= 31 || c === 127)) {
      return true;
    }
  }
  return false;
}

function hasUnsafeCmsPathSegment(pathname: string): boolean {
  return pathname.split('/').some((segment) => {
    if (segment === '.' || segment === '..') {
      return true;
    }
    const decoded = decodedPathSegment(segment);
    return decoded === null || decoded === '.' || decoded === '..';
  });
}

export function isSafeCmsAppPath(
  value: string,
  options?: { allowQueryAndFragment?: boolean }
): boolean {
  if (cmsHrefHasAsciiControlOrDelete(value)) {
    return false;
  }
  if (
    value.includes('\\') ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    (!options?.allowQueryAndFragment &&
      (value.includes('?') || value.includes('#')))
  ) {
    return false;
  }
  return !hasUnsafeCmsPathSegment(value.slice(0, pathPartEndIndex(value)));
}

export function safeCmsHref(value: string | null | undefined): string | null {
  const href = value?.trim();
  if (!href) {
    return null;
  }
  if (href === '#') {
    return href;
  }
  if (href.includes('\\')) {
    return null;
  }
  if (href.startsWith('/')) {
    return isSafeCmsAppPath(href, { allowQueryAndFragment: true })
      ? href
      : null;
  }

  try {
    const url = new URL(href);
    return SAFE_CMS_HREF_PROTOCOLS.has(url.protocol) ? href : null;
  } catch {
    return null;
  }
}

/**
 * Sanitizes CMS menu `href` values for public renderers: safe app paths, `http`/`https`,
 * and `mailto`, with bare paths normalized to a leading `/`.
 *
 * @param value - Raw path or absolute URL from CMS
 * @returns Usable `href` or `undefined` when unsafe or malformed
 */
export function safeCmsMenuItemHref(
  value: string | null | undefined
): string | undefined {
  const href = value?.trim();
  if (!href) {
    return undefined;
  }
  if (cmsHrefHasAsciiControlOrDelete(href)) {
    return undefined;
  }
  if (/\s/.test(href)) {
    return undefined;
  }
  if (href === '#') {
    return href;
  }
  if (href.includes('\\')) {
    return undefined;
  }
  const lower = href.toLowerCase();
  /* eslint-disable no-script-url -- block unsafe schemes from CMS-controlled hrefs */
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    /* eslint-enable no-script-url */
    return undefined;
  }
  if (href.startsWith('//')) {
    return undefined;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    try {
      const url = new URL(href);
      if (!SAFE_CMS_MENU_ITEM_PROTOCOLS.has(url.protocol)) {
        return undefined;
      }
      return href;
    } catch {
      return undefined;
    }
  }

  const path = href.startsWith('/') ? href : `/${href}`;
  return isSafeCmsAppPath(path, { allowQueryAndFragment: true })
    ? path
    : undefined;
}

/**
 * True when `href` is a safe app-root path for CMS UIs (rich text anchors, in-page links),
 * including optional `?query` and `#fragment`. Rejects backslashes, `.` / `..` segments
 * (including percent-encoded), non-leading slashes, and ASCII control/delete characters.
 *
 * @param href Candidate href string (typically from CMS content).
 * @returns Whether the href is allowed as an app-relative CMS link.
 */
export function isAppRelativeCmsHref(href: string): boolean {
  return isSafeCmsAppPath(href, { allowQueryAndFragment: true });
}

export function externalCmsLinkProps(href: string): {
  rel?: 'noopener noreferrer';
  target?: '_blank';
} {
  let protocol: string;
  try {
    ({ protocol } = new URL(href));
  } catch {
    return {};
  }
  if (protocol === 'http:' || protocol === 'https:') {
    return {
      rel: 'noopener noreferrer',
      target: '_blank',
    };
  }
  return {};
}
