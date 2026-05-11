import { EVENTS_TIME_ZONE, nyYmd } from '@/lib/mit-sailing/nyTime';

const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENTS_TIME_ZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const dateNoYearFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENTS_TIME_ZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const timeOnlyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENTS_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * @param start - Start instant
 * @param end - End instant
 * @returns Prose range, e.g. `Sat, Mar 7, 2026 · 9:00 AM – 5:00 PM`
 */
export function formatEasternEventRange(start: Date, end: Date): string {
  const startKey = nyYmd(start);
  const endKey = nyYmd(end);
  const t1 = timeOnlyFormatter.format(start);
  const t2 = timeOnlyFormatter.format(end);
  if (startKey === endKey) {
    return `${fullDateFormatter.format(start)} · ${t1} – ${t2}`;
  }
  return `${fullDateFormatter.format(start)} ${t1} – ${fullDateFormatter.format(end)} ${t2}`;
}

/**
 * @param d - Instant
 * @returns Single Eastern date+time string
 */
export function formatEasternDateTime(d: Date): string {
  return `${fullDateFormatter.format(d)} ${timeOnlyFormatter.format(d)}`;
}

/**
 * Compact time line for home sidebar rows when start and end share a calendar day
 * in Eastern; otherwise the full `formatEasternEventRange` string.
 *
 * @param start - Event start
 * @param end - Event end
 * @returns Time range, or a full date+time line when the event spans NY days
 */
export function formatEasternSameDayTimeRange(start: Date, end: Date): string {
  if (nyYmd(start) !== nyYmd(end)) {
    return formatEasternEventRange(start, end);
  }
  return `${timeOnlyFormatter.format(start)} – ${timeOnlyFormatter.format(end)}`;
}

/**
 * Formats a civil ISO calendar date for compact marketing display.
 * Uses noon UTC so timezone shifting does not change the calendar day.
 *
 * @param iso - `YYYY-MM-DD`
 * @returns US short weekday + date string, or `iso` when the pattern does not match
 */
export function formatEasternShortDateFromIsoCalendar(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    return iso;
  }
  const y = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const instant = new Date(Date.UTC(y, month - 1, day, 12, 0, 0));
  return fullDateFormatter.format(instant);
}

/**
 * @param params - Event occurrence segment
 * @returns Compact line for calendar rows
 */
export function formatEasternEventCalendarLine(params: {
  start: Date;
  end: Date;
  segment: 'single' | 'multi-start' | 'multi-end' | 'ongoing';
}): string {
  if (params.segment === 'single') {
    return formatEasternSameDayTimeRange(params.start, params.end);
  }
  if (params.segment === 'multi-end' || params.segment === 'ongoing') {
    return `Until ${timeOnlyFormatter.format(params.end)} ET`;
  }

  const startYear = Number(nyYmd(params.start).slice(0, 4));
  const endYear = Number(nyYmd(params.end).slice(0, 4));
  const endDate =
    startYear === endYear
      ? dateNoYearFormatter.format(params.end)
      : fullDateFormatter.format(params.end);
  return `${timeOnlyFormatter.format(params.start)} – ${endDate}, ${timeOnlyFormatter.format(
    params.end
  )} ET`;
}
