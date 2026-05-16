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
    'oxfmt',
    'oxlint-tsgolint',
    'postcss',
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
