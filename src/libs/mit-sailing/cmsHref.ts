const SAFE_CMS_HREF_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function safeCmsHref(value: string | null | undefined): string | null {
  const href = value?.trim();
  if (!href) {
    return null;
  }
  if (href === '#') {
    return href;
  }
  if (href.startsWith('/') && !href.startsWith('//')) {
    return href;
  }

  try {
    const url = new URL(href);
    return SAFE_CMS_HREF_PROTOCOLS.has(url.protocol) ? href : null;
  } catch {
    return null;
  }
}

export function isAppRelativeCmsHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}

export function externalCmsLinkProps(href: string): {
  rel?: 'noopener noreferrer';
  target?: '_blank';
} {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return {
      rel: 'noopener noreferrer',
      target: '_blank',
    };
  }
  return {};
}
