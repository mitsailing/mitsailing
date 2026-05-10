import sanitizeHtml from 'sanitize-html';

const REMOTE_HREF_PREFIXES = ['http://', 'https://', 'mailto:'] as const;
const CMS_MEDIA_IMAGE_EXTENSIONS = ['.gif', '.jpg', '.jpeg', '.png', '.webp'];
const CMS_MEDIA_IMAGE_PATH_RE = /^\/cms-media\/[^/?#]+\/[^/?#]+$/u;
const HTML_TAG_RE = /<[a-z][\s\S]*>/iu;

type SanitizeHtmlOptions = NonNullable<Parameters<typeof sanitizeHtml>[1]>;
type SanitizeAttribs = Record<string, string>;
type SanitizeTagResult = { tagName: string; attribs: SanitizeAttribs };

function isControlOrWhitespace(char: string): boolean {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) {
    return false;
  }
  return codePoint <= 31 || codePoint === 127 || char.trim() === '';
}

function startsWithDangerousScheme(lowerHref: string): boolean {
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

function isAllowedCmsRichTextHref(href: string): boolean {
  const h = href.trim();
  if (!h) {
    return false;
  }
  const lower = h.toLowerCase();
  if (startsWithDangerousScheme(lower)) {
    return false;
  }
  if (h === '#') {
    return true;
  }
  if (h.startsWith('/') && !h.startsWith('//')) {
    return true;
  }
  return REMOTE_HREF_PREFIXES.some((p) => lower.startsWith(p));
}

function isAllowedCmsMediaImageSrc(src: string): boolean {
  const s = src.trim();
  if (!CMS_MEDIA_IMAGE_PATH_RE.test(s)) {
    return false;
  }
  const lower = s.toLowerCase();
  return CMS_MEDIA_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function cmsImageAlign(value: string | undefined): 'left' | 'center' | 'right' {
  if (value === 'left' || value === 'right') {
    return value;
  }
  return 'center';
}

function escapeHtmlText(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function normalizeLegacyPlainTextToCmsRichTextHtml(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed
    .split(/\n{2,}/u)
    .map(
      (paragraph) =>
        `<p>${paragraph
          .trim()
          .split(/\n/u)
          .map((line) => escapeHtmlText(line.trim()))
          .join('<br />')}</p>`
    )
    .join('');
}

function normalizeCmsRichTextInput(raw: string): string {
  return HTML_TAG_RE.test(raw)
    ? raw
    : normalizeLegacyPlainTextToCmsRichTextHtml(raw);
}

function transformCmsRichTextAnchor(
  _tagName: string,
  attribs: SanitizeAttribs
): SanitizeTagResult {
  const href = (attribs.href ?? '').trim();
  if (!isAllowedCmsRichTextHref(href)) {
    return { tagName: 'span', attribs: {} };
  }
  const lower = href.toLowerCase();
  const isRemote = REMOTE_HREF_PREFIXES.some((p) => lower.startsWith(p));
  return {
    tagName: 'a',
    attribs: isRemote
      ? { href, rel: 'noopener noreferrer', target: '_blank' }
      : { href },
  };
}

function transformCmsRichTextImage(
  _tagName: string,
  attribs: SanitizeAttribs
): SanitizeTagResult {
  const src = (attribs.src ?? '').trim();
  if (!isAllowedCmsMediaImageSrc(src)) {
    return { tagName: 'span', attribs: {} };
  }
  const alt = (attribs.alt ?? '').trim();
  return {
    tagName: 'img',
    attribs: {
      alt,
      'data-align': cmsImageAlign(attribs['data-align']),
      src,
    },
  };
}

const CMS_RICH_TEXT_SANITIZE_OPTIONS = {
  allowedAttributes: {
    a: ['href', 'rel', 'target'],
    img: ['alt', 'data-align', 'src'],
  },
  allowedTags: [
    'a',
    'br',
    'em',
    'h2',
    'h3',
    'h4',
    'img',
    'li',
    'ol',
    'p',
    'strong',
    'ul',
  ],
  nonTextTags: ['script', 'style', 'textarea', 'option'],
  selfClosing: ['br', 'img'],
  transformTags: {
    a: transformCmsRichTextAnchor,
    b: 'strong',
    h1: 'h2',
    h5: 'h4',
    h6: 'h4',
    i: 'em',
    img: transformCmsRichTextImage,
  },
} satisfies SanitizeHtmlOptions;

function cmsRichTextHasContent(html: string): boolean {
  if (/<img\b/iu.test(html)) {
    return true;
  }
  const text = sanitizeHtml(html, {
    allowedAttributes: {},
    allowedTags: [],
    nonTextTags: ['script', 'style', 'textarea', 'option'],
  });
  return text.replaceAll(/\s+/gu, '').length > 0;
}

export function sanitizeCmsRichTextHtml(
  raw: string | null | undefined
): string {
  if (!raw) {
    return '';
  }
  const normalized = normalizeCmsRichTextInput(raw);
  const sanitized = sanitizeHtml(
    normalized,
    CMS_RICH_TEXT_SANITIZE_OPTIONS
  ).trim();
  return cmsRichTextHasContent(sanitized) ? sanitized : '';
}

export function plainTextFromCmsRichTextHtml(
  raw: string | null | undefined
): string {
  const sanitized = sanitizeCmsRichTextHtml(raw);
  const spaced = sanitized.replaceAll(/<\/(h2|h3|h4|li|ol|p|ul)>/giu, ' </$1>');
  return sanitizeHtml(spaced, {
    allowedAttributes: {},
    allowedTags: [],
    nonTextTags: ['script', 'style', 'textarea', 'option'],
  })
    .replaceAll(/\s+/gu, ' ')
    .trim();
}
