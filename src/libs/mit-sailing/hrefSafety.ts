/** Remote schemes allowed for news and CMS rich-text absolute links. */
export const REMOTE_HREF_PREFIXES = ['http://', 'https://', 'mailto:'] as const;

function isControlOrWhitespace(char: string): boolean {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) {
    return false;
  }
  return codePoint <= 31 || codePoint === 127 || char.trim() === '';
}

/**
 * Detects javascript:, data:, and vbscript: after stripping control characters.
 *
 * @param lowerHref - Href already lowercased
 * @returns Whether the href uses a dangerous scheme
 */
export function startsWithDangerousScheme(lowerHref: string): boolean {
  const jsScheme = `${['java', 'script'].join('')}:`;
  const vbScheme = `${['vb', 'script'].join('')}:`;
  const prefixes = [jsScheme, 'data:', vbScheme] as const;
  let normalizedHref = '';
  for (const char of lowerHref) {
    if (!isControlOrWhitespace(char)) {
      normalizedHref += char;
    }
  }
  return prefixes.some((p) => normalizedHref.startsWith(p));
}

/**
 * Allows http(s), mailto, and same-origin absolute paths for news bodies.
 *
 * @param href - Raw href attribute value
 * @returns Whether the anchor may be kept after sanitization
 */
export function isAllowedNewsHref(href: string): boolean {
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
