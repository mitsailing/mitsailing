const NY = 'America/New_York';

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: NY,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: NY,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const timeOnlyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: NY,
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * @param d - Instant
 * @returns Calendar day in America/New_York (YYYY-MM-DD) for same-day comparisons
 */
function formatNyDateKey(d: Date): string {
  return dateKeyFormatter.format(d);
}

/**
 * @param start - Start instant
 * @param end - End instant
 * @returns Prose range, e.g. `Sat, Mar 7, 2026 · 9:00 AM – 5:00 PM ET`
 */
export function formatEasternEventRange(start: Date, end: Date): string {
  const startKey = formatNyDateKey(start);
  const endKey = formatNyDateKey(end);
  const t1 = timeOnlyFormatter.format(start);
  const t2 = timeOnlyFormatter.format(end);
  if (startKey === endKey) {
    return `${fullDateFormatter.format(start)} · ${t1} – ${t2} ET`;
  }
  return `${fullDateFormatter.format(start)} ${t1} – ${fullDateFormatter.format(end)} ${t2} ET`;
}

/**
 * @param d - Instant
 * @returns Single Eastern date+time string
 */
export function formatEasternDateTime(d: Date): string {
  return `${fullDateFormatter.format(d)} ${timeOnlyFormatter.format(d)} ET`;
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
  if (formatNyDateKey(start) !== formatNyDateKey(end)) {
    return formatEasternEventRange(start, end);
  }
  return `${timeOnlyFormatter.format(start)} – ${timeOnlyFormatter.format(end)} ET`;
}

/**
 * @param d - Instant
 * @returns Calendar day in America/New_York (`YYYY-MM-DD`) for same-day comparisons
 */
export function formatEasternCalendarDateKey(d: Date): string {
  return formatNyDateKey(d);
}

const isoCalendarDayDisplayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

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
  return isoCalendarDayDisplayFormatter.format(instant);
}
