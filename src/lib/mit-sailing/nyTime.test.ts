import { describe, expect, it } from 'vitest';
import { calendarYearInEventsTimeZone } from '@/lib/mit-sailing/nyTime';

describe('calendarYearInEventsTimeZone', () => {
  it('uses America/New_York when UTC calendar year differs', () => {
    const instant = new Date('2026-01-01T00:00:00.000Z');
    expect(instant.getUTCFullYear()).toBe(2026);
    expect(calendarYearInEventsTimeZone(instant)).toBe(2025);
  });
});
