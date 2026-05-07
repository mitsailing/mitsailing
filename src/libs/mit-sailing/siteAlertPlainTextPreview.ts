/**
 * Strips angle-bracket tags and collapses whitespace from HTML-ish alert bodies.
 *
 * @param htmlish - Stored body markup (sanitized subset)
 * @returns Plain text for previews and listings
 */
export function plainTextFromSiteAlertHtmlish(htmlish: string): string {
  return htmlish
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

/**
 * Builds plain text from alert body markup for banner rows and admin list previews.
 *
 * @param htmlish - Stored body markup (sanitized subset)
 * @returns Full plain text (no truncation)
 */
export function siteAlertPlainTextPreview(htmlish: string): string {
  return plainTextFromSiteAlertHtmlish(htmlish);
}
