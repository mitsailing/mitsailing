import type {
  Config,
  UponSanitizeAttributeHookEvent,
} from 'isomorphic-dompurify';
import { addHook, sanitize } from 'isomorphic-dompurify';

const blockedHrefPrefixes = ['java'.concat('script:'), 'data:', 'vbscript:'];
let hooksInstalled = false;

const allowedCmsClasses = new Set([
  'image',
  'image-inline',
  'image_resized',
  'image-style-align-left',
  'image-style-align-right',
  'image-style-align-center',
  'image-style-block-align-left',
  'image-style-block-align-right',
  'image-style-side',
]);

function safeCmsClassList(value: string): string | null {
  const classes = value
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => allowedCmsClasses.has(item));
  return classes.length > 0 ? classes.join(' ') : null;
}

function safeCmsStyle(value: string): string | null {
  for (const declaration of value.split(';')) {
    const match = declaration
      .trim()
      .replaceAll(/\s+/g, ' ')
      .match(/^width:\s*(\d+(?:\.\d+)?)%$/u);
    if (!match) {
      continue;
    }
    const [, rawPercent] = match;
    if (!rawPercent) {
      continue;
    }
    const percent = Number(rawPercent);
    if (percent > 0 && percent <= 100) {
      return `width: ${rawPercent}%;`;
    }
  }
  return null;
}

function rejectAttribute(data: UponSanitizeAttributeHookEvent): void {
  data.keepAttr = false;
}

function sanitizeImageSrc(
  node: Element,
  data: UponSanitizeAttributeHookEvent
): void {
  if (node.nodeName !== 'IMG') {
    return;
  }
  const v = String(data.attrValue ?? '').trim();
  if (!v.startsWith('/api/uploads/')) {
    rejectAttribute(data);
  }
}

function sanitizeCmsClass(data: UponSanitizeAttributeHookEvent): void {
  const safeClasses = safeCmsClassList(String(data.attrValue ?? ''));
  if (safeClasses) {
    data.attrValue = safeClasses;
    return;
  }
  rejectAttribute(data);
}

function sanitizeCmsStyle(
  node: Element,
  data: UponSanitizeAttributeHookEvent
): void {
  if (node.nodeName !== 'FIGURE' && node.nodeName !== 'IMG') {
    rejectAttribute(data);
    return;
  }
  const safeStyle = safeCmsStyle(String(data.attrValue ?? ''));
  if (safeStyle) {
    data.attrValue = safeStyle;
    return;
  }
  rejectAttribute(data);
}

function sanitizeLinkTarget(data: UponSanitizeAttributeHookEvent): void {
  if (String(data.attrValue ?? '') !== '_blank') {
    rejectAttribute(data);
  }
}

function sanitizeLinkRel(data: UponSanitizeAttributeHookEvent): void {
  const allowedRelValues = new Set(['noopener', 'noreferrer']);
  const rel = String(data.attrValue ?? '')
    .split(/\s+/)
    .filter((item) => allowedRelValues.has(item));
  if (rel.length === 0) {
    rejectAttribute(data);
    return;
  }
  data.attrValue = rel.join(' ');
}

function sanitizeAnchorHref(
  node: Element,
  data: UponSanitizeAttributeHookEvent
): void {
  if (node.nodeName !== 'A') {
    return;
  }
  const v = String(data.attrValue ?? '')
    .trim()
    .toLowerCase();
  if (blockedHrefPrefixes.some((prefix) => v.startsWith(prefix))) {
    rejectAttribute(data);
  }
}

function sanitizeMarketingAttribute(
  node: Element,
  data: UponSanitizeAttributeHookEvent
): void {
  if (data.attrName === 'src') {
    sanitizeImageSrc(node, data);
  } else if (data.attrName === 'class') {
    sanitizeCmsClass(data);
  } else if (data.attrName === 'style') {
    sanitizeCmsStyle(node, data);
  } else if (data.attrName === 'target') {
    sanitizeLinkTarget(data);
  } else if (data.attrName === 'rel') {
    sanitizeLinkRel(data);
  } else if (data.attrName === 'href') {
    sanitizeAnchorHref(node, data);
  }
}

function installMarketingSanitizeHooks(): void {
  if (hooksInstalled) {
    return;
  }
  hooksInstalled = true;

  addHook('uponSanitizeAttribute', sanitizeMarketingAttribute);
}

const SANITIZE_OPTIONS: Config = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'ul',
    'ol',
    'li',
    'a',
    'h2',
    'h3',
    'h4',
    'figure',
    'figcaption',
    'img',
    'blockquote',
  ],
  ALLOWED_ATTR: [
    'class',
    'href',
    'rel',
    'src',
    'alt',
    'width',
    'height',
    'style',
    'target',
  ],
};

/**
 * Strips unsafe markup for marketing HTML stored from the admin rich text
 * editor before `dangerouslySetInnerHTML`.
 *
 * @param dirty - Raw HTML from the database
 * @returns Sanitized HTML string
 */
export function sanitizeMarketingHtml(dirty: string): string {
  installMarketingSanitizeHooks();
  return sanitize(dirty ?? '', SANITIZE_OPTIONS);
}
