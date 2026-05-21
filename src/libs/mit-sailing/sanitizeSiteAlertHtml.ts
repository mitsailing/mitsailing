import sanitizeHtml from 'sanitize-html';

/** Allowed schemes for remote links (`transformSiteAlertAnchor` adds rel/target). */
const REMOTE_HREF_PREFIXES = ['http://', 'https://', 'mailto:'] as const;

function startsWithDangerousScheme(lowerHref: string): boolean {
  const jsScheme = `${['java', 'script'].join('')}:`;
  const vbScheme = `${['vb', 'script'].join('')}:`;
  const prefixes = [jsScheme, 'data:', vbScheme] as const;
  return prefixes.some((p) => lowerHref.startsWith(p));
}

function isAllowedHref(href: string): boolean {
  const h = href.trim();
  if (!h) {
    return false;
  }
  const lower = h.toLowerCase();
  if (startsWithDangerousScheme(lower)) {
    return false;
  }
  if (h.startsWith('/') && !h.startsWith('//')) {
    return true;
  }
  return REMOTE_HREF_PREFIXES.some((p) => lower.startsWith(p));
}

type SanitizeHtmlOptions = NonNullable<Parameters<typeof sanitizeHtml>[1]>;
type SanitizeAttribs = Record<string, string>;
type SanitizeTagResult = { tagName: string; attribs: SanitizeAttribs };

function transformSiteAlertAnchor(
  _tagName: string,
  attribs: SanitizeAttribs
): SanitizeTagResult {
  const href = (attribs.href ?? '').trim();
  if (!isAllowedHref(href)) {
    return { tagName: 'span', attribs: {} };
  }
  const lower = href.toLowerCase();
  const isRemote = REMOTE_HREF_PREFIXES.some((p) => lower.startsWith(p));
  if (isRemote) {
    return {
      tagName: 'a',
      attribs: {
        href,
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    };
  }
  return {
    tagName: 'a',
    attribs: { href },
  };
}

const SITE_ALERT_SANITIZE_OPTIONS = {
  allowedTags: ['a', 'br'],
  allowedAttributes: {
    a: ['href', 'rel', 'target'],
  },
  nonTextTags: ['script', 'style', 'textarea', 'option', 'xmp'],
  transformTags: {
    a: transformSiteAlertAnchor,
  },
} satisfies SanitizeHtmlOptions;

/**
 * Keeps plain text, `<br>`, and safe `<a href>` only (no bold or other markup).
 * Absolute links open in a new tab with `noopener noreferrer`.
 *
 * @param raw - Untrusted HTML/markup from admins
 * @returns Sanitized HTML safe for `dangerouslySetInnerHTML`
 */
export function sanitizeSiteAlertBodyHtml(raw: string): string {
  return sanitizeHtml(raw, SITE_ALERT_SANITIZE_OPTIONS);
}
