const SAFE_CMS_HREF_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

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
