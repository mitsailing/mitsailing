/** IANA zone for US Eastern (EST + EDT). */
export const EVENTS_TIME_ZONE = 'America/New_York';

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

export function nextNyYmd(ymd: string): string {
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

export function prevNyYmd(ymd: string): string {
  const s = startOfNyCalendarDay(ymd);
  return nyYmd(new Date(s.getTime() - 1));
}

export function addNyCalendarDays(ymd: string, days: number): string {
  let k = ymd;
  const step = days >= 0 ? 1 : -1;
  for (let i = 0; i < Math.abs(days); i += 1) {
    k = step > 0 ? nextNyYmd(k) : prevNyYmd(k);
  }
  return k;
}

export function nyMonthFirstYmd(year: number, month: number): string {
  const m = String(month).padStart(2, '0');
  return `${year}-${m}-01`;
}

export function listNyDayKeysInMonth(year: number, month: number): string[] {
  const keys: string[] = [];
  let k = nyMonthFirstYmd(year, month);
  while (true) {
    const y = Number(k.slice(0, 4));
    const mo = Number(k.slice(5, 7));
    if (y !== year || mo !== month) {
      break;
    }
    keys.push(k);
    k = nextNyYmd(k);
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
  return map[key] ?? 0;
}
