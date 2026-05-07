/**
 * Parses `YYYY-MM-DDTHH:mm` as civil clock time in America/New_York (handles DST).
 *
 * @param isoLocal - Value from `<input type="datetime-local">` labeled for Eastern time
 * @returns UTC instant, or `null` when malformed or not representable
 */
export function easternDatetimeLocalToUtc(isoLocal: string): Date | null {
  const trimmed = isoLocal.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  function wallClockFromUtc(ms: number) {
    const parts = formatter.formatToParts(new Date(ms));
    const pick = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value ?? Number.NaN);
    return {
      year: pick('year'),
      month: pick('month'),
      day: pick('day'),
      hour: pick('hour'),
      minute: pick('minute'),
    };
  }

  const anchor = Date.UTC(year, month - 1, day, 17, 0, 0);
  for (let deltaMin = -36 * 60; deltaMin <= 36 * 60; deltaMin += 1) {
    const ms = anchor + deltaMin * 60_000;
    const w = wallClockFromUtc(ms);
    if (
      w.year === year &&
      w.month === month &&
      w.day === day &&
      w.hour === hour &&
      w.minute === minute
    ) {
      return new Date(ms);
    }
  }
  return null;
}

/**
 * Formats a UTC instant as `YYYY-MM-DDTHH:mm` for Eastern civil time (datetime-local).
 *
 * @param d - Instant
 * @returns String suitable for `<input type="datetime-local">`
 */
export function utcToEasternDatetimeLocal(d: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}`;
}
