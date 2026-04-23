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
