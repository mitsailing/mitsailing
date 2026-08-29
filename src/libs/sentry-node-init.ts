import * as Sentry from '@sentry/nextjs';
import { sentryCaptureRates } from '@/libs/sentryCaptureRates';

/**
 * Shared Sentry options for the Next.js Node and Edge runtimes.
 * Keep in sync with [`src/instrumentation-client.ts`](../instrumentation-client.ts)
 * and [`src/libs/sentry-worker-init.ts`](./sentry-worker-init.ts).
 */
export const sentryNodeOptions: Sentry.NodeOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [Sentry.consoleLoggingIntegration()],
  sendDefaultPii: true,
  ...sentryCaptureRates,
  enableLogs: true,
  debug: false,
};

/**
 * Initializes the Sentry Next.js Node SDK when not disabled.
 * Safe to call once per Next.js Node process from instrumentation.
 */
export function initSentryNode(): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
    return;
  }
  Sentry.init(sentryNodeOptions);
}
