/**
 * Seed rows for `SiteAlert` (home banner + `/alerts`).
 *
 * `createdByUserId` / `updatedByUserId` reference stub user `user-ak` from `eventsSeed.ts`.
 */
export const SITE_ALERT_SEED_ROWS = [
  {
    id: 'seed-site-alert-demo-through-2030',
    body: 'Demo site alert — Seeded for local testing; visible on the home banner and <a href="/en/alerts">the alerts page</a> through 2030.',
    isPublished: true,
    startDate: new Date(Date.UTC(2025, 0, 1)),
    lastDate: new Date(Date.UTC(2030, 11, 31)),
    createdByUserId: 'user-ak',
    updatedByUserId: 'user-ak',
  },
] as const;
