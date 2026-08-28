/**
 * No-op Sentry surface for Storybook. Node Sentry and `@logtape/sentry` pull
 * OpenTelemetry, which uses `__dirname` and fails in the browser.
 *
 * @returns Empty event id
 */
export function captureException(): string {
  return '';
}

/**
 * No-op message capture for Storybook client stories.
 *
 * @returns Empty event id
 */
export function captureMessage(): string {
  return '';
}

function ignoreSentryLogRecord(): void {
  // Storybook does not forward logs to Sentry.
}

/**
 * No-op LogTape Sentry sink for Storybook logger configuration.
 *
 * @returns Sink that ignores records
 */
export function getSentrySink(): () => void {
  return ignoreSentryLogRecord;
}
