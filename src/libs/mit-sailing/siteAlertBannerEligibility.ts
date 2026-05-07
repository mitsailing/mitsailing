import { formatEasternCalendarDateKey } from '@/libs/mit-sailing/easternTimeFormat';

/**
 * Published alert eligible for the home banner at `now`: inside the date-only visibility window (Eastern “today”).
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
  if (!props.isPublished) {
    return false;
  }
  const today = formatEasternCalendarDateKey(props.now);
  if (props.startDateIso > today) {
    return false;
  }
  if (props.lastDateIso < today) {
    return false;
  }
  return true;
}
