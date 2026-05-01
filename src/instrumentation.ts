import * as Sentry from '@sentry/nextjs';

/**
 * Shared Node + Edge SDK options. Initialization runs only from this file
 * (no root `sentry.server.config.ts` / `sentry.edge.config.ts`) to avoid duplicate
 * `Sentry.init` and to keep the DSN on `NEXT_PUBLIC_SENTRY_DSN`.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */
const sentryOptions: Sentry.NodeOptions | Sentry.EdgeOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  spotlight: process.env.NODE_ENV === 'development',
  integrations: [Sentry.consoleLoggingIntegration()],
  sendDefaultPii: true,
  tracesSampleRate: 1,
  enableLogs: true,
  debug: false,
};

export function register() {
  if (process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
    return;
  }
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init(sentryOptions);
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init(sentryOptions);
  }
}

export const onRequestError = Sentry.captureRequestError;
