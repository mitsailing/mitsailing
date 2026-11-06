/**
 * Strips angle-bracket tags and collapses whitespace from HTML-ish news bodies.
 *
 * @param htmlish - Stored body markup (sanitized subset)
 * @returns Plain text for banner fingerprints and admin catalog lists
 */
export function plainTextFromNewsHtmlish(htmlish: string): string {
  return htmlish
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}
