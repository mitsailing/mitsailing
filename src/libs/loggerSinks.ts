/**
 * Whether app logs should also open Sentry Issues via `@logtape/sentry`.
 * Tests and Playwright set `NEXT_PUBLIC_SENTRY_DISABLED`.
 *
 * @param env - Process env (or a test stub) to read `NEXT_PUBLIC_SENTRY_DISABLED` from
 * @returns False when Sentry is disabled for this process
 */
export function shouldForwardLogsToSentry(
  env: Record<string, string | undefined> = process.env
): boolean {
  return !env.NEXT_PUBLIC_SENTRY_DISABLED;
}

/**
 * Builds the ordered sink name list for the `app` logger.
 *
 * @param options - Which optional sinks to attach after console
 * @returns Sink names in configure order
 */
export function buildAppLoggerSinkNames(options: {
  forwardToBetterStack: boolean;
  forwardToSentry: boolean;
}): readonly string[] {
  const sinks = ['console'];
  if (options.forwardToBetterStack) {
    sinks.push('betterStack');
  }
  if (options.forwardToSentry) {
    sinks.push('sentry');
  }
  return sinks;
}
