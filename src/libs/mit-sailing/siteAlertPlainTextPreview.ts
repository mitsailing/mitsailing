type SiteAlertPlainTextPreviewOptions = {
  htmlish: string;
  maxLength: number;
};

/**
 * Builds a compact plain-text preview from alert body markup.
 *
 * @param options - HTML-ish input and maximum preview length
 * @returns Plain text preview, truncated with an ellipsis when needed
 */
export function siteAlertPlainTextPreview(
  options: SiteAlertPlainTextPreviewOptions
): string {
  const plain = options.htmlish
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();

  if (plain.length <= options.maxLength) {
    return plain;
  }

  return `${plain.slice(0, options.maxLength - 1)}…`;
}
