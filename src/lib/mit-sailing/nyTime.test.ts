import { describe, expect, it } from 'vitest';
import {
  calendarYearInEventsTimeZone,
  formatNyDateTimeLocalInput,
} from '@/lib/mit-sailing/nyTime';

describe('calendarYearInEventsTimeZone', () => {
  it('uses America/New_York when UTC calendar year differs', () => {
    const instant = new Date('2026-01-01T00:00:00.000Z');
    expect(instant.getUTCFullYear()).toBe(2026);
    expect(calendarYearInEventsTimeZone(instant)).toBe(2025);
  });
});

describe('formatNyDateTimeLocalInput', () => {
  it('uses America/New_York wall clock, not UTC slice', () => {
    const instant = new Date('2026-01-01T04:00:00.000Z');
    expect(instant.toISOString().slice(0, 16)).toBe('2026-01-01T04:00');
    expect(formatNyDateTimeLocalInput(instant)).toBe('2025-12-31T23:00');
  });
});
