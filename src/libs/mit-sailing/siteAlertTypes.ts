/**
 * Site alert row shaped for public marketing (banner and `/alerts`).
 */
export type SiteAlertPublicItem = {
  id: string;
  /** Civil ISO start date (`YYYY-MM-DD`). */
  startDateIso: string;
  body: string;
};

/** Home banner row with formatted date labels (built on the server). */
export type SiteAlertBannerRow = {
  id: string;
  /** Plain text derived from the HTML-ish body (tags stripped). */
  bodyPlainText: string;
  dateLabel: string;
  /** Civil ISO date shown beside the message (start day). */
  dateIso: string;
};
