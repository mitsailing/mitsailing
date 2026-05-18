import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // Files to exclude from Knip analysis
  ignore: [
    'checkly.config.ts',
    'src/libs/I18n.ts',
    // Used by next-intl request config above; Knip ignores that entrypoint.
    'src/libs/site-text/siteTextMessageLoader.ts',
    'src/types/I18n.ts',
    // Manual admin/developer utility for folding DB overrides back into en.json.
    'scripts/export-i18n-overrides.ts',
    // Manual one-off importer for owned legacy Pavilion reservation CSV history.
    'scripts/import-legacy-pavilion-reservations.ts',
    // Invoked by Docker Compose healthcheck + Dockerfile COPY; not a Node import graph entry
    'scripts/worker-redis-healthcheck.cjs',
    // Invoked by esbuild's `server-only` alias in `npm run build:worker`.
    'src/worker/serverOnlyShim.ts',
    // Catalog + time helpers: partially consumed by prisma seed; getters/types fill in when UI is ported
    'src/data/mit-sailing/**',
    'src/lib/mit-sailing/**',
  ],
  // Dependencies to ignore during analysis
  ignoreDependencies: [
    '@commitlint/types',
    '@swc/helpers', // Avoid error in CI: "`npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync."
  ],
  // Binaries to ignore during analysis
  ignoreBinaries: [
    'production', // False positive raised with dotenv-cli
  ],
  compilers: {
    css: (text: string) => [...text.matchAll(/(?<=@)import[^;]+/g)].join('\n'),
  },
  ignoreIssues: {
    'src/components/mit-sailing/donate/DonateAlternateGivingSection.tsx': [
      'types',
    ],
    'src/components/mit-sailing/site/NavigationDropdown.tsx': ['types'],
    'src/libs/admin/catalog/scopedCatalogLists.ts': ['types'],
    'src/libs/admin/catalog/types.ts': ['types'],
    'src/libs/admin/events/eventAdminQueries.ts': ['types'],
    'src/libs/admin/pavilion-reservations/pavilionReservationAdminQueries.ts': [
      'types',
    ],
    'src/libs/health/readiness.ts': ['types'],
    'src/libs/legacy-sync/postgresMirrorSql.ts': ['types'],
    'src/libs/mit-sailing/catalogHistory.ts': ['types'],
    'src/libs/mit-sailing/classQueries.ts': ['types'],
    'src/libs/mit-sailing/classRelatedOccurrences.ts': ['types'],
    'src/libs/mit-sailing/cmsHistory.ts': ['types'],
    'src/libs/mit-sailing/cmsHomeOverview.ts': ['types'],
    'src/libs/mit-sailing/cmsMediaTypes.ts': ['exports'],
    'src/libs/mit-sailing/eventCalendar.ts': ['types'],
    'src/libs/mit-sailing/pavilionReservationBookingTimeline.ts': ['types'],
    'src/libs/newsletter/newsletterActions.ts': ['types'],
    'src/libs/newsletter/newsletterConstants.ts': ['exports'],
    'src/libs/newsletter/newsletterValidation.ts': ['types'],
  },
};

export default config;
