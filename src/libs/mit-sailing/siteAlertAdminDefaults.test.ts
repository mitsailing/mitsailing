import { describe, expect, it } from 'vitest';
import {
  easternNextCalendarDayIso,
  siteAlertsNewCatalogDefaults,
} from '@/libs/mit-sailing/siteAlertAdminDefaults';

describe('easternNextCalendarDayIso', () => {
  it('returns the next Eastern calendar day', () => {
    const instant = new Date('2026-05-07T16:00:00.000Z');
    expect(easternNextCalendarDayIso(instant)).toBe('2026-05-08');
  });
});

describe('siteAlertsNewCatalogDefaults', () => {
  it('sets last date after start date for the same reference instant', () => {
    const instant = new Date('2026-05-07T16:00:00.000Z');
    const row = siteAlertsNewCatalogDefaults(instant);
    const start = row['startDate'];
    const last = row['lastDate'];
    expect(typeof start).toBe('string');
    expect(typeof last).toBe('string');
    if (typeof start === 'string' && typeof last === 'string') {
      expect(last > start).toBe(true);
    }
  });
});
