import {
  EVENTS_TIME_ZONE,
  listNyDayKeysInMonth,
  nyMonthFirstYmd,
  nyWeekdaySunday0,
  nyYmd,
  startOfNyCalendarDay,
} from '@/lib/mit-sailing/nyTime';

export type EventCalendarMonth = {
  year: number;
  month: number;
};

export type EventCalendarMonthBounds = {
  minYear: number;
  minMonth: number;
  maxYear: number;
  maxMonth: number;
};

export type EventCalendarListSegment =
  | 'single'
  | 'multi-start'
  | 'multi-end'
  | 'ongoing';

export type EventCalendarCategory = {
  id: string;
  name: string;
  displayOrder: number;
};

export type EventCalendarEvent = {
  id: string;
  name: string;
  slug: string;
  eventCategoryId: string;
  category: {
    id: string;
    name: string;
    /** Resolved Tailwind `bg-*` bar class (from DB or catalog defaults). */
    accentClassName: string;
  };
};

export type EventCalendarDate = {
  id: string;
  startDateTime: Date;
  endDateTime: Date;
  event: EventCalendarEvent;
};

export type EventCalendarOccurrenceRow = {
  eventDate: EventCalendarDate;
  rowKey: string;
  displayDayKey: string;
  listSegment: EventCalendarListSegment;
  start: Date;
  end: Date;
  event: EventCalendarEvent;
  category: EventCalendarEvent['category'];
};

export type EventCalendarMonthRange = {
  firstDayKey: string;
  lastDayKey: string;
  start: Date;
  endExclusive: Date;
};

const monthParamPattern = /^(\d{4})-(\d{2})$/;

function calendarMonthIndex(month: EventCalendarMonth): number {
  return month.year * 12 + (month.month - 1);
}

function eventCalendarMonthFromIndex(index: number): EventCalendarMonth {
  const year = Math.floor(index / 12);
  const monthIndex = index - year * 12;
  return { year, month: monthIndex + 1 };
}

/**
 * @param date - Instant
 * @returns Calendar month in New York local time
 */
export function eventCalendarMonthFromDate(date: Date): EventCalendarMonth {
  const key = nyYmd(date);
  return {
    year: Number(key.slice(0, 4)),
    month: Number(key.slice(5, 7)),
  };
}

/**
 * @param monthParam - Optional URL month value (`YYYY-MM`); year 1–9999, month 01–12
 * @param reference - Fallback instant when URL value is missing or invalid
 * @returns Calendar month in New York local time
 */
export function parseEventCalendarMonthParam(
  monthParam: string | undefined,
  reference: Date
): EventCalendarMonth {
  const match = monthParam?.match(monthParamPattern);
  const rawYear = match?.[1];
  const rawMonth = match?.[2];
  if (!rawYear || !rawMonth) {
    return eventCalendarMonthFromDate(reference);
  }

  const year = Number(rawYear);
  const month = Number(rawMonth);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12
  ) {
    return eventCalendarMonthFromDate(reference);
  }

  return { year, month };
}

/**
 * @param month - Calendar month
 * @returns URL-safe month key (`YYYY-MM`)
 */
export function eventCalendarMonthKey(month: EventCalendarMonth): string {
  return `${String(month.year).padStart(4, '0')}-${String(month.month).padStart(
    2,
    '0'
  )}`;
}

/**
 * @param month - Calendar month
 * @param amount - Signed month offset
 * @returns Shifted calendar month
 */
export function addEventCalendarMonths(
  month: EventCalendarMonth,
  amount: number
): EventCalendarMonth {
  return eventCalendarMonthFromIndex(calendarMonthIndex(month) + amount);
}

/**
 * @param month - Candidate month
 * @param bounds - Catalog month bounds
 * @returns Month constrained to catalog bounds
 */
export function clampEventCalendarMonth(
  month: EventCalendarMonth,
  bounds: EventCalendarMonthBounds
): EventCalendarMonth {
  const min = calendarMonthIndex({
    year: bounds.minYear,
    month: bounds.minMonth,
  });
  const max = calendarMonthIndex({
    year: bounds.maxYear,
    month: bounds.maxMonth,
  });
  const clamped = Math.max(min, Math.min(max, calendarMonthIndex(month)));
  return eventCalendarMonthFromIndex(clamped);
}

/**
 * @param month - Candidate month
 * @param bounds - Catalog month bounds
 * @returns Whether the previous catalog month exists
 */
export function canGoToPreviousEventCalendarMonth(
  month: EventCalendarMonth,
  bounds: EventCalendarMonthBounds
): boolean {
  return (
    calendarMonthIndex(month) >
    calendarMonthIndex({ year: bounds.minYear, month: bounds.minMonth })
  );
}

/**
 * @param month - Candidate month
 * @param bounds - Catalog month bounds
 * @returns Whether the next catalog month exists
 */
export function canGoToNextEventCalendarMonth(
  month: EventCalendarMonth,
  bounds: EventCalendarMonthBounds
): boolean {
  return (
    calendarMonthIndex(month) <
    calendarMonthIndex({ year: bounds.maxYear, month: bounds.maxMonth })
  );
}

/**
 * @param month - Calendar month
 * @returns New York month boundary instants for overlap queries
 */
export function getEventCalendarMonthRange(
  month: EventCalendarMonth
): EventCalendarMonthRange {
  const dayKeys = listNyDayKeysInMonth(month.year, month.month);
  const firstDayKey = dayKeys[0] ?? nyMonthFirstYmd(month.year, month.month);
  const lastDayKey = dayKeys.at(-1) ?? firstDayKey;
  const nextMonth = addEventCalendarMonths(month, 1);
  return {
    firstDayKey,
    lastDayKey,
    start: startOfNyCalendarDay(firstDayKey),
    endExclusive: startOfNyCalendarDay(
      nyMonthFirstYmd(nextMonth.year, nextMonth.month)
    ),
  };
}

/**
 * @param month - Calendar month
 * @returns Calendar weeks, padded with `null` cells
 */
export function buildEventCalendarWeeks(
  month: EventCalendarMonth
): (string | null)[][] {
  const dayKeys = listNyDayKeysInMonth(month.year, month.month);
  if (dayKeys.length === 0) {
    return [];
  }
  const first = dayKeys[0] ?? '';
  const leading = nyWeekdaySunday0(first);
  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...dayKeys,
  ];
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function dateKeyIsInRange(
  dateKey: string,
  rangeStartKey: string,
  rangeEndKey: string
): boolean {
  return dateKey >= rangeStartKey && dateKey <= rangeEndKey;
}

function nextDateKey(dateKey: string): string {
  const next = new Date(
    Date.UTC(
      Number(dateKey.slice(0, 4)),
      Number(dateKey.slice(5, 7)) - 1,
      Number(dateKey.slice(8, 10)) + 1
    )
  );
  return next.toISOString().slice(0, 10);
}

/**
 * @param params - Event date rows and inclusive New York day keys
 * @returns Rows for calendar/list rendering
 */
export function buildEventCalendarOccurrenceRows(params: {
  eventDates: readonly EventCalendarDate[];
  rangeStartKey: string;
  rangeEndKey: string;
}): EventCalendarOccurrenceRow[] {
  const rows: EventCalendarOccurrenceRow[] = [];

  for (const eventDate of params.eventDates) {
    const start = eventDate.startDateTime;
    const end = eventDate.endDateTime;
    const startKey = nyYmd(start);
    const endKey = nyYmd(end);
    const base = {
      eventDate,
      start,
      end,
      event: eventDate.event,
      category: eventDate.event.category,
    };

    if (startKey === endKey) {
      if (
        !dateKeyIsInRange(startKey, params.rangeStartKey, params.rangeEndKey)
      ) {
        continue;
      }
      rows.push({
        ...base,
        rowKey: `${eventDate.id}-${startKey}-single`,
        displayDayKey: startKey,
        listSegment: 'single',
      });
      continue;
    }

    if (dateKeyIsInRange(startKey, params.rangeStartKey, params.rangeEndKey)) {
      rows.push({
        ...base,
        rowKey: `${eventDate.id}-${startKey}-start`,
        displayDayKey: startKey,
        listSegment: 'multi-start',
      });
    }

    if (dateKeyIsInRange(endKey, params.rangeStartKey, params.rangeEndKey)) {
      rows.push({
        ...base,
        rowKey: `${eventDate.id}-${endKey}-end`,
        displayDayKey: endKey,
        listSegment: 'multi-end',
      });
    }

    let ongoingKey =
      startKey >= params.rangeStartKey
        ? nextDateKey(startKey)
        : params.rangeStartKey;
    while (ongoingKey < endKey && ongoingKey <= params.rangeEndKey) {
      rows.push({
        ...base,
        rowKey: `${eventDate.id}-${ongoingKey}-ongoing`,
        displayDayKey: ongoingKey,
        listSegment: 'ongoing',
      });
      ongoingKey = nextDateKey(ongoingKey);
    }
  }

  const segmentOrder: Record<EventCalendarListSegment, number> = {
    single: 0,
    'multi-start': 1,
    ongoing: 2,
    'multi-end': 3,
  };
  return rows.toSorted((a, b) => {
    const day = a.displayDayKey.localeCompare(b.displayDayKey);
    if (day !== 0) {
      return day;
    }
    const time = a.start.getTime() - b.start.getTime();
    if (time !== 0) {
      return time;
    }
    return segmentOrder[a.listSegment] - segmentOrder[b.listSegment];
  });
}

/**
 * @param rows - Occurrence rows already filtered to the visible month
 * @returns Rows grouped by display day key
 */
export function groupEventCalendarRowsByDay(
  rows: readonly EventCalendarOccurrenceRow[]
): Map<string, EventCalendarOccurrenceRow[]> {
  const grouped = new Map<string, EventCalendarOccurrenceRow[]>();
  for (const row of rows) {
    const dayRows = grouped.get(row.displayDayKey);
    if (dayRows) {
      dayRows.push(row);
    } else {
      grouped.set(row.displayDayKey, [row]);
    }
  }
  return grouped;
}

export type EventCalendarMobileDayGroup = {
  dateKey: string;
  isToday: boolean;
  headingLabel: string;
  rows: EventCalendarOccurrenceRow[];
};

/**
 * @param params - Calendar rows and reference instant
 * @returns Day groups for narrow screens
 */
export function groupEventCalendarRowsForMobile(params: {
  rows: readonly EventCalendarOccurrenceRow[];
  reference: Date;
  locale: string;
  todayLabel: string;
}): EventCalendarMobileDayGroup[] {
  const todayKey = nyYmd(params.reference);
  const referenceYear = Number(todayKey.slice(0, 4));
  const grouped = groupEventCalendarRowsByDay(params.rows);
  return [...grouped.keys()].toSorted().map((dateKey) => {
    const date = startOfNyCalendarDay(dateKey);
    const year = Number(dateKey.slice(0, 4));
    const headingLabel =
      dateKey === todayKey
        ? params.todayLabel
        : new Intl.DateTimeFormat(params.locale, {
            timeZone: EVENTS_TIME_ZONE,
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            ...(year === referenceYear ? {} : { year: 'numeric' as const }),
          }).format(date);
    return {
      dateKey,
      isToday: dateKey === todayKey,
      headingLabel,
      rows: grouped.get(dateKey) ?? [],
    };
  });
}

/**
 * @param month - Calendar month
 * @param categoryId - Optional active category
 * @returns Events calendar URL with month/category query state
 */
export function eventsCalendarHref(
  month: EventCalendarMonth,
  categoryId?: string
): string {
  const params = new URLSearchParams({ month: eventCalendarMonthKey(month) });
  if (categoryId) {
    params.set('category', categoryId);
  }
  return `/events/?${params.toString()}`;
}

/**
 * @param date - Reference instant
 * @returns Current New York month
 */
export function getCurrentEventCalendarMonth(date: Date): EventCalendarMonth {
  return eventCalendarMonthFromDate(date);
}

/**
 * @param date - Reference instant
 * @returns Current New York day key
 */
export function getCurrentEventCalendarDayKey(date: Date): string {
  return nyYmd(date);
}
