import withBundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import './src/libs/Env';
import { MAX_UPLOAD_BYTES } from './src/libs/uploads/maxUploadBytes';

// Define the base Next.js configuration
const maxUploadMb = Math.ceil(MAX_UPLOAD_BYTES / (1024 * 1024));

const baseConfig: NextConfig = {
  experimental: {
    // Caps how much of the client body Next buffers when a proxy/middleware
    // path clones the request. If the limit is exceeded, only a **partial**
    // body is available and a warning is logged — the upload handler still
    // enforces `MAX_UPLOAD_BYTES` on the parsed `File` so oversize uploads
    // get a 413 instead of silently accepting truncated files.
    proxyClientMaxBodySize: `${maxUploadMb}mb`,
  },
  devIndicators: {
    position: 'bottom-right',
  },
  poweredByHeader: false,
  reactStrictMode: true,
  reactCompiler: process.env.NODE_ENV === 'production', // Keep the development environment fast
  // `standalone` produces `.next/standalone/` — a minimal node_modules +
  // server bundle that the production Docker stage COPYs on top of a slim
  // base image. Without this, the prod image would need the entire
  // workspace deps, roughly tripling the image size.
  output: 'standalone',
  outputFileTracingIncludes: {
    '/': ['./prisma/migrations/**/*'],
  },
  images: {
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
