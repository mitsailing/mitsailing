import { describe, expect, it } from 'vitest';
import {
  parseSiteAlertDates,
  rawSiteAlertFromFormData,
  siteAlertFormSchema,
} from '@/libs/admin/catalog/siteAlertSchemas';
import { prismaDateFromIsoCalendar } from '@/libs/mit-sailing/isoCalendarDate';

describe('parseSiteAlertDates', () => {
  it('parses start and last dates', () => {
    const data = siteAlertFormSchema.parse({
      body: '',
      startDate: '2026-07-04',
      lastDate: '2026-07-05',
      isPublished: false,
    });
    const parsed = parseSiteAlertDates(data);
    expect(parsed).not.toBeNull();
    if (parsed) {
      const expectedStart = prismaDateFromIsoCalendar('2026-07-04');
      const expectedLast = prismaDateFromIsoCalendar('2026-07-05');
      expect(expectedStart).not.toBeNull();
      expect(expectedLast).not.toBeNull();
      if (expectedStart && expectedLast) {
        expect(parsed.startDate.toISOString()).toBe(
          expectedStart.toISOString()
        );
        expect(parsed.lastDate.toISOString()).toBe(expectedLast.toISOString());
      }
    }
  });

  it('returns null when last precedes start', () => {
    const raw = {
      body: '',
      startDate: '2026-07-05',
      lastDate: '2026-07-04',
      isPublished: false,
    };
    expect(siteAlertFormSchema.safeParse(raw).success).toBe(true);
    expect(parseSiteAlertDates(siteAlertFormSchema.parse(raw))).toBeNull();
  });

  it('returns null when last date string is invalid', () => {
    const raw = {
      body: '',
      startDate: '2026-07-04',
      lastDate: 'invalid',
      isPublished: false,
    };
    expect(siteAlertFormSchema.safeParse(raw).success).toBe(true);
    expect(parseSiteAlertDates(siteAlertFormSchema.parse(raw))).toBeNull();
  });
});

describe('rawSiteAlertFromFormData', () => {
  it('reads isPublished from checkboxes', () => {
    const fd = new FormData();
    fd.set('body', 'Hello');
    fd.set('startDate', '2026-01-01');
    fd.set('lastDate', '2026-12-31');
    fd.append('isPublished', 'true');
    const raw = rawSiteAlertFromFormData(fd);
    expect(raw['isPublished']).toBe(true);
    expect(siteAlertFormSchema.safeParse(raw).success).toBe(true);
  });

  it('maps absent date keys to empty strings', () => {
    const fd = new FormData();
    fd.set('body', 'x');
    fd.append('isPublished', 'false');
    const raw = rawSiteAlertFromFormData(fd);
    expect(raw['startDate']).toBe('');
    expect(raw['lastDate']).toBe('');
    expect(siteAlertFormSchema.safeParse(raw).success).toBe(false);
  });
});
