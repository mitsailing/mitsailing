/**
 * Site alert row shaped for public marketing (banner and `/alerts`).
 */
export type SiteAlertPublicItem = {
  id: string;
  /** Civil ISO start date (`YYYY-MM-DD`). */
  startDateIso: string;
  /** Civil inclusive last banner day (`YYYY-MM-DD`). */
  lastDateIso: string;
  body: string;
};

/** Home banner row with formatted date labels (built on the server). */
export type SiteAlertBannerRow = {
  id: string;
  /** Plain-text preview derived from HTML/text body. */
  preview: string;
  dateLabel: string;
  /** Civil ISO date shown beside the preview (last day). */
  dateIso: string;
};
