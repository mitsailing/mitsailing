/** IANA zone for US Eastern (EST + EDT). */
export const EVENTS_TIME_ZONE = 'America/New_York';

const dateTimeLocalInputFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENTS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  hourCycle: 'h23',
});

/**
 * Formats an instant as `YYYY-MM-DDTHH:mm` for `input type="datetime-local"`
 * in the New York venue wall clock.
 *
 * @param date - Instant to format
 * @returns Value suitable for `datetime-local` `defaultValue` / `value`
 */
export function formatNyDateTimeLocalInput(date: Date): string {
  const parts = dateTimeLocalInputFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get(
    'minute'
  )}`;
}

const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: EVENTS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const fullFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENTS_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hour12: false,
});

export function nyYmd(d: Date): string {
  return ymdFormatter.format(d);
}

/**
 * Gregorian calendar year for an instant on the {@link EVENTS_TIME_ZONE} wall clock
 * (venue time; see `.cursor/rules/dates-us-eastern.mdc`).
 *
 * @param now - Instant to evaluate (typically `new Date()`)
 * @returns Four-digit calendar year in the events time zone.
 */
export function calendarYearInEventsTimeZone(now: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: EVENTS_TIME_ZONE,
      year: 'numeric',
    }).format(now)
  );
}

type NyParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function nyWallParts(d: Date): NyParts {
  const parts = fullFormatter.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? Number.NaN);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

function compareNyWall(a: NyParts, b: NyParts): number {
  if (a.year !== b.year) {
    return a.year - b.year;
  }
  if (a.month !== b.month) {
    return a.month - b.month;
  }
  if (a.day !== b.day) {
    return a.day - b.day;
  }
  if (a.hour !== b.hour) {
    return a.hour - b.hour;
  }
  return a.minute - b.minute;
}

export function instantForNyWallClock(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  const target: NyParts = { year, month, day, hour, minute };
  let lo = Date.UTC(year, month - 1, day - 2, 0, 0, 0);
  let hi = Date.UTC(year, month - 1, day + 2, 0, 0, 0);
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const p = nyWallParts(new Date(mid));
    if (compareNyWall(p, target) < 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return new Date(hi);
}

export function startOfNyCalendarDay(ymd: string): Date {
  const parts = ymd.split('-').map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const d = parts[2] ?? 0;
  let lo = Date.UTC(y, m - 1, d - 2, 0, 0, 0);
  let hi = Date.UTC(y, m - 1, d + 2, 0, 0, 0);
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const key = nyYmd(new Date(mid));
    if (key < ymd) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return new Date(hi);
}

/**
 * Next calendar day after `ymd` in {@link EVENTS_TIME_ZONE}.
 *
 * @param ymd - New York civil date (`YYYY-MM-DD`)
 * @returns Following `YYYY-MM-DD` in that zone
 */
export function nextNyCalendarDay(ymd: string): string {
  const s = startOfNyCalendarDay(ymd);
  let lo = s.getTime();
  let hi = s.getTime() + 72 * 60 * 60 * 1000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (nyYmd(new Date(mid)) === ymd) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return nyYmd(new Date(hi));
}

function prevNyYmd(ymd: string): string {
  const s = startOfNyCalendarDay(ymd);
  return nyYmd(new Date(s.getTime() - 1));
}

function assertNyMonthParts(year: number, month: number): void {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new RangeError(`Invalid New York calendar year: ${year}`);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(
      `Invalid New York calendar month: year=${year} month=${month}`
    );
  }
}

export function addNyCalendarDays(ymd: string, days: number): string {
  let k = ymd;
  const step = days >= 0 ? 1 : -1;
  for (let i = 0; i < Math.abs(days); i += 1) {
    k = step > 0 ? nextNyCalendarDay(k) : prevNyYmd(k);
  }
  return k;
}

export function nyMonthFirstYmd(year: number, month: number): string {
  assertNyMonthParts(year, month);
  const m = String(month).padStart(2, '0');
  return `${String(year).padStart(4, '0')}-${m}-01`;
}

export function listNyDayKeysInMonth(year: number, month: number): string[] {
  assertNyMonthParts(year, month);
  const keys: string[] = [];
  let key = nyMonthFirstYmd(year, month);
  while (true) {
    const y = Number(key.slice(0, 4));
    const m = Number(key.slice(5, 7));
    if (y !== year || m !== month) {
      break;
    }
    keys.push(key);
    key = nextNyCalendarDay(key);
  }
  return keys;
}

const nyWeekdayShort = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENTS_TIME_ZONE,
  weekday: 'short',
});

export function nyWeekdaySunday0(ymd: string): number {
  const parts = nyWeekdayShort.formatToParts(startOfNyCalendarDay(ymd));
  const raw = parts.find((p) => p.type === 'weekday')?.value?.trim() ?? '';
  const key = raw.replace(/\.$/, '').slice(0, 3).toLowerCase();
  const map: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };
  const weekday = map[key];
  if (weekday === undefined) {
    throw new Error(`Unexpected New York weekday for ${ymd}: ${raw}`);
  }
  return weekday;
}
