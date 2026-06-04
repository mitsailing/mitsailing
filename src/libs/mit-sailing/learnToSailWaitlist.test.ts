import { describe, expect, it } from 'vitest';
import {
  activeLearnToSailWaitlistEntryKey,
  getLearnToSailSeasonYear,
  isLearnToSailWaitlistOpen,
} from '@/libs/mit-sailing/learnToSailWaitlist';

describe('learnToSailWaitlist', () => {
  it('opens the annual waitlist at midnight April 1 in Eastern time', () => {
    expect(
      isLearnToSailWaitlistOpen(new Date('2026-04-01T03:59:59.000Z'))
    ).toBe(false);
    expect(
      isLearnToSailWaitlistOpen(new Date('2026-04-01T04:00:00.000Z'))
    ).toBe(true);
  });

  it('uses the Eastern calendar year for the active season', () => {
    expect(
      getLearnToSailSeasonYear(new Date('2026-03-31T23:59:59-04:00'))
    ).toBe(2026);
    expect(
      getLearnToSailSeasonYear(new Date('2026-04-01T00:00:00-04:00'))
    ).toBe(2026);
    expect(
      getLearnToSailSeasonYear(new Date('2027-03-31T23:59:59-04:00'))
    ).toBe(2027);
  });

  it('builds one active uniqueness key per user and season', () => {
    expect(
      activeLearnToSailWaitlistEntryKey({
        seasonYear: 2026,
        userId: 'user-1',
      })
    ).toBe('2026:user-1');
  });
});
