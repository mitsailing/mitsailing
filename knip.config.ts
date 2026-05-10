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
    // Invoked by Docker Compose healthcheck + Dockerfile COPY; not a Node import graph entry
    'scripts/worker-redis-healthcheck.cjs',
    // Catalog + time helpers: partially consumed by prisma seed; getters/types fill in when UI is ported
    'src/data/mit-sailing/**',
    'src/lib/mit-sailing/**',
    // Stacked CMS PR foundations: consumed by the admin/public branches above this base.
    'src/libs/admin/catalog/adminCatalogPaths.ts',
    'src/libs/admin/catalog/catalogActions.ts',
    'src/libs/admin/catalog/catalogFieldErrors.ts',
    'src/libs/admin/catalog/cmsCatalogHandlers.ts',
    'src/libs/mit-sailing/cmsHistory.ts',
    'src/libs/mit-sailing/cmsHomeOverview.ts',
    'src/libs/mit-sailing/cmsMediaStorage.ts',
    'src/libs/mit-sailing/cmsPricing.ts',
    'src/libs/mit-sailing/cmsQueries.ts',
  ],
  // Dependencies to ignore during analysis
  ignoreDependencies: [
    '@commitlint/types',
    '@swc/helpers', // Avoid error in CI: "`npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync."
    'oxfmt',
    'oxlint-tsgolint',
    'postcss',
    '@tiptap/extension-image',
    '@tiptap/extension-link',
    '@tiptap/react',
    '@tiptap/starter-kit',
    'vite',
  ],
  // Binaries to ignore during analysis
  ignoreBinaries: [
    'production', // False positive raised with dotenv-cli
  ],
  compilers: {
    css: (text: string) => [...text.matchAll(/(?<=@)import[^;]+/g)].join('\n'),
  },
};

export default config;
