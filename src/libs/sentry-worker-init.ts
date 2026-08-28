import * as Sentry from '@sentry/node';
import { shouldForwardLogsToSentry } from '@/libs/loggerSinks';
import { sentryCaptureRates } from '@/libs/sentryCaptureRates';

/**
 * Initializes the Node Sentry SDK before the worker logs through LogTape.
 * The worker is a standalone ESM bundle; `@sentry/nextjs` does not export
 * `consoleLoggingIntegration` or `captureException` on that ESM namespace.
 */
if (shouldForwardLogsToSentry()) {
  Sentry.init({
    debug: false,
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enableLogs: true,
    integrations: [Sentry.consoleLoggingIntegration()],
    sendDefaultPii: true,
    ...sentryCaptureRates,
  });
}
