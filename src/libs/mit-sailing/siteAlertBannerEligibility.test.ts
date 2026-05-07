import { describe, expect, it } from 'vitest';
import { siteAlertEligibleForBannerAt } from '@/libs/mit-sailing/siteAlertBannerEligibility';

/** Noon UTC on a calendar day that is still the same NY calendar date in EDT. */
const nyNoonUtc = '2026-04-15T16:00:00.000Z';

describe('siteAlertEligibleForBannerAt', () => {
  it('excludes unpublished rows', () => {
    expect(
      siteAlertEligibleForBannerAt({
        isPublished: false,
        startDateIso: '2026-04-01',
        lastDateIso: '2026-04-30',
        now: new Date(nyNoonUtc),
      })
    ).toBe(false);
  });

  it('excludes rows before start date', () => {
    expect(
      siteAlertEligibleForBannerAt({
        isPublished: true,
        startDateIso: '2026-04-16',
        lastDateIso: '2026-05-01',
        now: new Date(nyNoonUtc),
      })
    ).toBe(false);
  });

  it('includes published rows inside window', () => {
    expect(
      siteAlertEligibleForBannerAt({
        isPublished: true,
        startDateIso: '2026-04-01',
        lastDateIso: '2026-05-01',
        now: new Date(nyNoonUtc),
      })
    ).toBe(true);
  });

  it('includes rows on end date', () => {
    expect(
      siteAlertEligibleForBannerAt({
        isPublished: true,
        startDateIso: '2026-04-01',
        lastDateIso: '2026-04-15',
        now: new Date(nyNoonUtc),
      })
    ).toBe(true);
  });

  it('excludes rows after end date', () => {
    expect(
      siteAlertEligibleForBannerAt({
        isPublished: true,
        startDateIso: '2026-04-01',
        lastDateIso: '2026-04-14',
        now: new Date(nyNoonUtc),
      })
    ).toBe(false);
  });
});
