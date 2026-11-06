import sanitizeHtml from 'sanitize-html';

/** Allowed schemes for remote links (`transformNewsAnchor` adds rel/target). */
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

function transformNewsAnchor(
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

const NEWS_SANITIZE_OPTIONS = {
  allowedTags: ['a', 'br', 'em', 'p', 'strong'],
  allowedAttributes: {
    a: ['href', 'rel', 'target'],
  },
  nonTextTags: ['script', 'style', 'textarea', 'option', 'xmp'],
  transformTags: {
    a: transformNewsAnchor,
  },
} satisfies SanitizeHtmlOptions;

/** Banner strip stays one link to `/news`; unwrap `a` so link text remains. */
const NEWS_BANNER_SANITIZE_OPTIONS = {
  allowedTags: ['br', 'em', 'p', 'strong'],
  allowedAttributes: {},
  nonTextTags: ['script', 'style', 'textarea', 'option', 'xmp'],
} satisfies SanitizeHtmlOptions;

/**
 * Keeps paragraphs, line breaks, bold, italic, and safe links.
 * Absolute links open in a new tab with `noopener noreferrer`.
 *
 * @param raw - Untrusted HTML/markup from admins
 * @returns Sanitized HTML safe for `dangerouslySetInnerHTML`
 */
export function sanitizeNewsBodyHtml(raw: string): string {
  return sanitizeHtml(raw, NEWS_SANITIZE_OPTIONS);
}

/**
 * Same subset as {@link sanitizeNewsBodyHtml} with anchors unwrapped to text.
 * Use inside the single banner link to `/news` so nested anchors cannot appear.
 *
 * @param raw - Untrusted HTML/markup from admins
 * @returns Sanitized HTML without `a` tags
 */
export function sanitizeNewsBodyHtmlForBanner(raw: string): string {
  return sanitizeHtml(raw, NEWS_BANNER_SANITIZE_OPTIONS);
}
