import withBundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import './src/libs/Env';

const isE2eBuild = process.env.IS_E2E === '1';

// Define the base Next.js configuration
const baseConfig: NextConfig = {
  devIndicators: {
    position: 'bottom-right',
  },
  poweredByHeader: false,
  skipProxyUrlNormalize: true,
  reactStrictMode: true,
  reactCompiler: process.env.NODE_ENV === 'production', // Keep the development environment fast
  // `standalone` produces `.next/standalone/` — a minimal node_modules +
  // server bundle that the production Docker stage COPYs on top of a slim
  // base image. Without this, the prod image would need the entire
  // workspace deps, roughly tripling the image size.
  output: 'standalone',
  outputFileTracingIncludes: {
    '/': ['./prisma/migrations/**/*'],
    '/*': [
      './node_modules/@ioredis/commands/**/*',
      './node_modules/bullmq/**/*',
      './node_modules/cluster-key-slot/**/*',
      './node_modules/denque/**/*',
      './node_modules/ioredis/**/*',
      './node_modules/lodash.defaults/**/*',
      './node_modules/lodash.isarguments/**/*',
      './node_modules/msgpackr/**/*',
      './node_modules/node-abort-controller/**/*',
      './node_modules/redis-errors/**/*',
      './node_modules/redis-parser/**/*',
      './node_modules/semver/**/*',
      './node_modules/standard-as-callback/**/*',
      './node_modules/tslib/**/*',
    ],
  },
  images: {
    // Playwright navigations wait for the browser load event by default. In the
    // standalone E2E server, Next image optimization can keep local image
    // requests open long enough to make unrelated route assertions flaky.
    unoptimized: isE2eBuild,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'mitsailing.com',
        pathname: '/**',
      },
    ],
  },
  // Align with the image tag or release id so clients hard-reload on version skew
  // (see https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId).
  ...(process.env.DEPLOYMENT_VERSION
    ? { deploymentId: process.env.DEPLOYMENT_VERSION }
    : {}),
  // Sitemap is `force-dynamic` + `unstable_cache` (24h) on origin; shared caches
  // should hold the XML so crawlers do not stampede the app. Matches sitemap TTL.
  headers: () => [
    {
      source: '/sitemap.xml',
      headers: [
        {
          key: 'Cache-Control',
          value:
            'public, max-age=0, s-maxage=86400, stale-while-revalidate=43200',
        },
      ],
    },
  ],
};

// Initialize the Next-Intl plugin
let configWithPlugins = createNextIntlPlugin('./src/libs/I18n.ts')(baseConfig);

// Conditionally enable bundle analysis
if (process.env.ANALYZE === 'true') {
  configWithPlugins = withBundleAnalyzer()(configWithPlugins);
}

const nextConfig: NextConfig = configWithPlugins;

// https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/
export default process.env.NEXT_PUBLIC_SENTRY_DISABLED
  ? nextConfig
  : withSentryConfig(nextConfig, {
      org: 'mit-sailing',
      project: 'javascript-nextjs',
      authToken: process.env.SENTRY_AUTH_TOKEN,

      silent: !process.env.CI,
      widenClientFileUpload: true,
      tunnelRoute: '/monitoring',
      telemetry: false,

      webpack: {
        reactComponentAnnotation: {
          enabled: true,
        },
        automaticVercelMonitors: true,
        treeshake: {
          removeDebugLogging: true,
        },
      },
    });
