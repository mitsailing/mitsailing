import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // Files to exclude from Knip analysis
  ignore: [
    'checkly.config.ts',
    'src/libs/I18n.ts',
    'src/types/I18n.ts',
    // Invoked by Docker Compose healthcheck + Dockerfile COPY; not a Node import graph entry
    'scripts/worker-redis-healthcheck.cjs',
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
