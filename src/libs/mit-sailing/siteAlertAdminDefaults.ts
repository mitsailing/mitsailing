import { nyYmd } from '@/lib/mit-sailing/nyTime';
import type { CatalogRow } from '@/libs/admin/catalog/types';

/**
 * Next America/New_York calendar day after {@link fromInstant}'s calendar day.
 *
 * @param fromInstant - Reference instant
 * @returns Eastern civil date key (`YYYY-MM-DD`) for the following calendar day
 */
export function easternNextCalendarDayIso(fromInstant: Date): string {
  const startKey = nyYmd(fromInstant);
  let t = fromInstant.getTime();
  for (let i = 0; i < 72; i += 1) {
    t += 60 * 60 * 1000;
    const key = nyYmd(new Date(t));
    if (key !== startKey) {
      return key;
    }
  }
  return nyYmd(new Date(fromInstant.getTime() + 48 * 60 * 60 * 1000));
}

/**
 * Default {@link CatalogRow} fragments for `GET /admin/site_alerts/new`.
 *
 * @param now - Typically server request time
 * @returns Partial row with ISO start/end dates for `<input type="date">`
 */
export function siteAlertsNewCatalogDefaults(now = new Date()): CatalogRow {
  const startDateIso = nyYmd(now);
  const lastDateIso = easternNextCalendarDayIso(now);
  return {
    startDate: startDateIso,
    lastDate: lastDateIso,
  };
}
