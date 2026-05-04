import type { Config } from 'isomorphic-dompurify';
import { addHook, sanitize } from 'isomorphic-dompurify';

let hooksInstalled = false;

function installMarketingSanitizeHooks(): void {
  if (hooksInstalled) {
    return;
  }
  hooksInstalled = true;

  addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName === 'src' && node.nodeName === 'IMG') {
      const v = String(data.attrValue ?? '').trim();
      if (!v.startsWith('/api/uploads/')) {
        data.keepAttr = false;
      }
    }
    if (data.attrName === 'href' && node.nodeName === 'A') {
      const v = String(data.attrValue ?? '')
        .trim()
        .toLowerCase();
      /* eslint-disable no-script-url -- comparing against untrusted href values */
      if (
        v.startsWith('javascript:') ||
        v.startsWith('data:') ||
        v.startsWith('vbscript:')
      ) {
        /* eslint-enable no-script-url */
        data.keepAttr = false;
      }
    }
  });
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
    'img',
    'blockquote',
  ],
  ALLOWED_ATTR: ['href', 'rel', 'src', 'alt', 'width', 'height'],
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
