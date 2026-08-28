import * as Sentry from '@sentry/nextjs';

/**
 * Shared Sentry options for the Next.js Node runtime and the BullMQ worker.
 * Keep in sync with [`src/instrumentation.ts`](../instrumentation.ts) client-adjacent settings.
 */
export const sentryNodeOptions: Sentry.NodeOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  spotlight: process.env.NODE_ENV === 'development',
  integrations: [Sentry.consoleLoggingIntegration()],
  sendDefaultPii: true,
  tracesSampleRate: 1,
  enableLogs: true,
  debug: false,
};

/**
 * Initializes the Sentry Node SDK when not disabled.
 * Safe to call once per process (worker entry and Next instrumentation).
 */
export function initSentryNode(): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
    return;
  }
  Sentry.init(sentryNodeOptions);
}
