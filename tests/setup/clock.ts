import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Fixed instant every unit and component test starts from.
 *
 * Sits before the July 15 sailing-card rollover in `getCurrentSailingCardYear`,
 * so the current card year is always 2026 and no real calendar date can change
 * a test result. Override with `vi.setSystemTime` in a suite only to exercise a
 * specific date boundary.
 */
export const TEST_NOW = new Date('2026-06-01T12:00:00-04:00');

beforeEach(() => {
  // Without `useFakeTimers`, this mocks only `Date`, leaving `setTimeout` and
  // `waitFor` on real timers.
  vi.setSystemTime(TEST_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});
