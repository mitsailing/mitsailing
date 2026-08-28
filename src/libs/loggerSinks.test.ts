import { describe, expect, it } from 'vitest';
import {
  buildAppLoggerSinkNames,
  shouldForwardLogsToSentry,
} from '@/libs/loggerSinks';

describe('loggerSinks', () => {
  it('includes sentry when forwarding is enabled', () => {
    expect(
      buildAppLoggerSinkNames({
        forwardToBetterStack: false,
        forwardToSentry: true,
      })
    ).toEqual(['console', 'sentry']);
  });

  it('omits sentry when forwarding is disabled', () => {
    expect(
      buildAppLoggerSinkNames({
        forwardToBetterStack: true,
        forwardToSentry: false,
      })
    ).toEqual(['console', 'betterStack']);
  });

  it('treats NEXT_PUBLIC_SENTRY_DISABLED as skip sentry', () => {
    expect(
      shouldForwardLogsToSentry({ NEXT_PUBLIC_SENTRY_DISABLED: 'true' })
    ).toBe(false);
    expect(shouldForwardLogsToSentry({})).toBe(true);
  });
});
