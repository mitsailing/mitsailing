import * as Sentry from '@sentry/nextjs';

/**
 * Intentional full capture until production error volume is understood.
 * `sampleRate` controls error events; `tracesSampleRate` controls performance spans.
 *
 * @see https://docs.sentry.io/platforms/javascript/configuration/sampling/
 */
export const sentryCaptureRates = {
  sampleRate: 1,
  tracesSampleRate: 1,
} as const;

/**
 * Shared Sentry options for the Next.js Node runtime and the BullMQ worker.
 * Keep in sync with [`src/instrumentation.ts`](../instrumentation.ts) client-adjacent settings.
 */
export const sentryNodeOptions: Sentry.NodeOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  spotlight: process.env.NODE_ENV === 'development',
  integrations: [Sentry.consoleLoggingIntegration()],
  sendDefaultPii: true,
  ...sentryCaptureRates,
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
