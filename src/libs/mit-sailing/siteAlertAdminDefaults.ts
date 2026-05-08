import { addNyCalendarDays, nyYmd } from '@/lib/mit-sailing/nyTime';
import type { CatalogRow } from '@/libs/admin/catalog/types';

/**
 * Next America/New_York calendar day after {@link fromInstant}'s calendar day.
 *
 * @param fromInstant - Reference instant
 * @returns Eastern civil date key (`YYYY-MM-DD`) for the following calendar day
 */
export function easternNextCalendarDayIso(fromInstant: Date): string {
  return addNyCalendarDays(nyYmd(fromInstant), 1);
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
