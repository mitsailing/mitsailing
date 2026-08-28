import { describe, expect, it } from 'vitest';

describe('Sentry Node SDK worker contract', () => {
  it('exports console logging and exception capture on the ESM namespace', async () => {
    const Sentry = await import('@sentry/node');

    expect(typeof Sentry.consoleLoggingIntegration).toBe('function');
    expect(typeof Sentry.captureException).toBe('function');
    expect(typeof Sentry.init).toBe('function');
  });
});
