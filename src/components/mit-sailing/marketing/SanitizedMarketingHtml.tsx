import 'server-only';
import { sanitizeMarketingHtml } from '@/lib/mit-sailing/sanitizeMarketingHtml';

type SanitizedMarketingHtmlProps = {
  html: string;
  className?: string;
};

/**
 * Renders CMS HTML after server-side sanitization for public pages.
 *
 * @param props - Raw HTML and optional wrapper classes
 * @returns Div with sanitized markup or null when empty after sanitization
 */
export function SanitizedMarketingHtml(props: SanitizedMarketingHtmlProps) {
  const safe = sanitizeMarketingHtml(props.html);
  if (!safe.trim()) {
    return null;
  }
  return (
    <div
      className={props.className}
      // eslint-disable-next-line react/no-danger -- sanitized in sanitizeMarketingHtml (server-only)
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
