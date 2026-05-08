import { describe, expect, it } from 'vitest';
import {
  isoCalendarDateFromPrismaDate,
  prismaDateFromIsoCalendar,
} from '@/libs/mit-sailing/isoCalendarDate';

describe('prismaDateFromIsoCalendar', () => {
  it('accepts valid Gregorian dates', () => {
    const d = prismaDateFromIsoCalendar('2026-05-07');
    expect(d).not.toBeNull();
    if (d) {
      expect(d.toISOString()).toBe('2026-05-07T00:00:00.000Z');
    }
  });

  it('rejects invalid calendar dates', () => {
    expect(prismaDateFromIsoCalendar('2026-02-30')).toBeNull();
    expect(prismaDateFromIsoCalendar('not-a-date')).toBeNull();
  });
});

describe('isoCalendarDateFromPrismaDate', () => {
  it('round-trips UTC midnight dates', () => {
    const iso = '2026-01-02';
    const d = prismaDateFromIsoCalendar(iso);
    expect(d).not.toBeNull();
    if (d) {
      expect(isoCalendarDateFromPrismaDate(d)).toBe(iso);
    }
  });
});
