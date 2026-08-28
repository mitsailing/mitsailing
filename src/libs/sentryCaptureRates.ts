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
