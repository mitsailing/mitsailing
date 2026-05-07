/**
 * Strips angle-bracket tags and collapses whitespace from HTML-ish alert bodies.
 *
 * @param htmlish - Stored body markup (sanitized subset)
 * @returns Plain text for banner rows and admin catalog lists
 */
export function plainTextFromSiteAlertHtmlish(htmlish: string): string {
  return htmlish
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}
