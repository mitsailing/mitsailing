/**
 * Seed rows for `News` (home banner + `/news`).
 */
export const NEWS_SEED_ROWS = [
  {
    id: 'seed-site-alert-demo-through-2030',
    body: 'Demo news — Seeded for local testing; visible on the home banner and <a href="/news">the news page</a> through 2030.',
    isPublished: true,
    startDate: new Date(Date.UTC(2025, 0, 1)),
    lastDate: new Date(Date.UTC(2030, 11, 31)),
  },
] as const;
