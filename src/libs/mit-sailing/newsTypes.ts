/**
 * News row shaped for public marketing (banner and `/news`).
 */
export type NewsPublicItem = {
  id: string;
  /** Civil ISO start date (`YYYY-MM-DD`). */
  startDateIso: string;
  body: string;
};

/** Home banner row with formatted date labels (built on the server). */
export type NewsBannerRow = {
  id: string;
  /**
   * Sanitized body HTML for the banner strip: paragraphs, bold, italic, and
   * line breaks only (anchors unwrapped so the strip can stay one link).
   */
  bodyHtml: string;
  /** Plain text derived from the HTML-ish body (tags stripped). */
  bodyPlainText: string;
  dateLabel: string;
  /** Civil ISO date shown beside the message (start day). */
  dateIso: string;
};
