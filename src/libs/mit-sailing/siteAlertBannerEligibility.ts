import { formatEasternCalendarDateKey } from '@/libs/mit-sailing/easternTimeFormat';

/**
 * Published alert eligible for the home banner on an Eastern calendar day: active from `startDateIso` through `lastDateIso`.
 *
 * Keep in sync with {@link prismaWhereSiteAlertBannerForCalendarDay} in `siteAlertQueries.ts`
 * (Postgres `DATE` bounds use the same UTC-midnight `Date` values as {@link prismaDateFromIsoCalendar}).
 *
 * @param props - Publish flag, ISO `YYYY-MM-DD` bounds, Eastern “today” key (same basis as {@link formatEasternCalendarDateKey})
 * @returns True when the row should appear in the banner list for that calendar day
 */
export function siteAlertEligibleForBannerOnEasternDay(props: {
  isPublished: boolean;
  startDateIso: string;
  lastDateIso: string;
  todayIso: string;
}): boolean {
  if (!props.isPublished) {
    return false;
  }
  if (props.startDateIso > props.todayIso) {
    return false;
  }
  if (props.lastDateIso < props.todayIso) {
    return false;
  }
  return true;
}

/**
 * Published alert eligible for the home banner at `now`: from start date through end date (Eastern “today”).
 *
 * Convenience wrapper around {@link siteAlertEligibleForBannerOnEasternDay}; production banner loading uses
 * {@link prismaWhereSiteAlertBannerForCalendarDay} instead.
 *
 * @param props - Publish flag, alert dates as ISO `YYYY-MM-DD`, evaluation instant
 * @returns True when the row should appear in the banner query at `now`
 */
export function siteAlertEligibleForBannerAt(props: {
  isPublished: boolean;
  startDateIso: string;
  lastDateIso: string;
  now: Date;
}): boolean {
  return siteAlertEligibleForBannerOnEasternDay({
    isPublished: props.isPublished,
    lastDateIso: props.lastDateIso,
    startDateIso: props.startDateIso,
    todayIso: formatEasternCalendarDateKey(props.now),
  });
}
