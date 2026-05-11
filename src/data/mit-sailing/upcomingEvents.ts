import {
  addNyCalendarDays,
  EVENTS_TIME_ZONE,
  nyYmd,
  startOfNyCalendarDay,
} from '@/lib/mit-sailing/nyTime';
import type { Event, EventCategory, EventDate } from './eventsSeed';
import { getEventById, GLOBAL_EVENT_DATES } from './eventsSeed';

const dateWithYear = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENTS_TIME_ZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const dateNoYear = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENTS_TIME_ZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENTS_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function formatTime(d: Date): string {
  return timeFmt.format(d);
}

/** Time-only line when the occurrence is listed under its start-day heading (same NY day). */
export function formatOccurrenceTimeLine(start: Date, end: Date): string {
  if (nyYmd(start) === nyYmd(end)) {
    return `${formatTime(start)} – ${formatTime(end)}`;
  }
  return formatEventDateRange(start, end);
}

export type ListSegment = 'single' | 'multi-start' | 'multi-end';

function inInclusiveNyRange(
  dateKey: string,
  rangeStartKey: string,
  rangeEndKey: string
): boolean {
  return dateKey >= rangeStartKey && dateKey <= rangeEndKey;
}

/** One-line time copy for a list row (single-day, first day of multi-day, or last day). */
export function formatOccurrenceListLine(row: UpcomingOccurrenceRow): string {
  switch (row.listSegment) {
    case 'single': {
      return formatOccurrenceTimeLine(row.start, row.end);
    }
    case 'multi-start': {
      return `${formatTime(row.start)} – ${dateNoYear.format(row.end)}, ${formatTime(row.end)}`;
    }
    case 'multi-end': {
      return `Until ${formatTime(row.end)}`;
    }
    default: {
      return formatOccurrenceTimeLine(row.start, row.end);
    }
  }
}

/** Range string for the sidebar; times always in US Eastern. */
export function formatEventDateRange(start: Date, end: Date): string {
  const sameNyDay = nyYmd(start) === nyYmd(end);
  if (sameNyDay) {
    return `${dateWithYear.format(start)} · ${formatTime(start)} – ${formatTime(end)}`;
  }
  const yStart = Number(nyYmd(start).slice(0, 4));
  const yEnd = Number(nyYmd(end).slice(0, 4));
  if (yStart === yEnd) {
    return `${dateNoYear.format(start)}, ${formatTime(start)} – ${dateNoYear.format(end)}, ${formatTime(end)}, ${yStart}`;
  }
  return `${dateWithYear.format(start)}, ${formatTime(start)} – ${dateWithYear.format(end)}, ${formatTime(end)}`;
}

export type UpcomingOccurrenceRow = {
  eventDate: EventDate;
  /** Stable key for React (multi-day events list twice). */
  rowKey: string;
  /** NY calendar day (YYYY-MM-DD) this row is grouped under. */
  displayDayKey: string;
  listSegment: ListSegment;
  start: Date;
  end: Date;
  event: Event;
  category: EventCategory | undefined;
  isStartingToday: boolean;
  dateLabel: string;
};

function collectOccurrenceRows(params: {
  events: Event[];
  categories: EventCategory[];
  eventDates: EventDate[];
  rangeStartKey: string;
  rangeEndKey: string;
  reference: Date;
}): UpcomingOccurrenceRow[] {
  const { rangeStartKey, rangeEndKey, reference } = params;
  const todayKey = nyYmd(reference);

  const eventById = new Map(params.events.map((e) => [e.id, e]));
  const categoryById = new Map(params.categories.map((c) => [c.id, c]));

  const rows: UpcomingOccurrenceRow[] = [];

  for (const eventDate of params.eventDates) {
    const start = new Date(eventDate.start_datetime);
    const end = new Date(eventDate.end_datetime);
    const startKey = nyYmd(start);
    const endKey = nyYmd(end);

    if (endKey < rangeStartKey || startKey > rangeEndKey) {
      continue;
    }

    const event = eventById.get(eventDate.eventId);
    if (!event) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[events] EventDate ${eventDate.id} references missing event ${eventDate.eventId}`
        );
      }
      continue;
    }

    const category = categoryById.get(event.event_category_id);
    if (!category && process.env.NODE_ENV !== 'production') {
      console.warn(
        `[events] Event ${event.id} has unknown event_category_id ${event.event_category_id}`
      );
    }

    const base = {
      eventDate,
      start,
      end,
      event,
      category,
      dateLabel: formatEventDateRange(start, end),
    };

    if (startKey === endKey) {
      if (!inInclusiveNyRange(startKey, rangeStartKey, rangeEndKey)) {
        continue;
      }
      rows.push({
        ...base,
        rowKey: `${eventDate.id}-${startKey}-single`,
        displayDayKey: startKey,
        listSegment: 'single',
        isStartingToday: startKey === todayKey,
      });
    } else {
      if (inInclusiveNyRange(startKey, rangeStartKey, rangeEndKey)) {
        rows.push({
          ...base,
          rowKey: `${eventDate.id}-${startKey}-start`,
          displayDayKey: startKey,
          listSegment: 'multi-start',
          isStartingToday: startKey === todayKey,
        });
      }
      if (
        inInclusiveNyRange(endKey, rangeStartKey, rangeEndKey) &&
        endKey !== startKey
      ) {
        rows.push({
          ...base,
          rowKey: `${eventDate.id}-${endKey}-end`,
          displayDayKey: endKey,
          listSegment: 'multi-end',
          isStartingToday: endKey === todayKey,
        });
      }
    }
  }

  const segmentOrder: Record<ListSegment, number> = {
    single: 0,
    'multi-start': 1,
    'multi-end': 2,
  };
  rows.sort((a, b) => {
    const dk = a.displayDayKey.localeCompare(b.displayDayKey);
    if (dk !== 0) {
      return dk;
    }
    const t = a.start.getTime() - b.start.getTime();
    if (t !== 0) {
      return t;
    }
    return segmentOrder[a.listSegment] - segmentOrder[b.listSegment];
  });
  return rows;
}

export function getOccurrencesInNyDayRange(params: {
  events: Event[];
  categories: EventCategory[];
  eventDates: EventDate[];
  rangeStartKey: string;
  rangeEndKey: string;
  reference?: Date;
}): UpcomingOccurrenceRow[] {
  return collectOccurrenceRows({
    events: params.events,
    categories: params.categories,
    eventDates: params.eventDates,
    rangeStartKey: params.rangeStartKey,
    rangeEndKey: params.rangeEndKey,
    reference: params.reference ?? new Date(),
  });
}

export function getUpcomingOccurrences(params: {
  events: Event[];
  categories: EventCategory[];
  eventDates: EventDate[];
  reference?: Date;
}): UpcomingOccurrenceRow[] {
  const reference = params.reference ?? new Date();
  const todayKey = nyYmd(reference);
  const windowEndKey = addNyCalendarDays(todayKey, 6);
  return collectOccurrenceRows({
    events: params.events,
    categories: params.categories,
    eventDates: params.eventDates,
    rangeStartKey: todayKey,
    rangeEndKey: windowEndKey,
    reference,
  });
}

export type UpcomingDayGroup = {
  dateKey: string;
  isToday: boolean;
  headingLabel: string;
  rows: UpcomingOccurrenceRow[];
};

function formatCalendarDayHeading(
  dateKey: string,
  referenceYear: number
): string {
  const d = startOfNyCalendarDay(dateKey);
  const y = Number(dateKey.slice(0, 4));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EVENTS_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(y !== referenceYear ? { year: 'numeric' as const } : {}),
  }).format(d);
}

/** Buckets occurrences by NY calendar day for display (`displayDayKey`). */
/** Next scheduled rows from the full catalog for a set of event IDs (e.g. class detail pages). */
export type CatalogOccurrencePreview = {
  event: Event;
  eventDate: EventDate;
  rangeLabel: string;
};

/**
 * For each `eventId` in order, returns up to `limitPerEvent` future `EventDate` rows from
 * `GLOBAL_EVENT_DATES` with start at or after `reference`.
 */
export function getNextOccurrencesForEventIds(
  eventIds: string[],
  options?: { reference?: Date; limitPerEvent?: number }
): CatalogOccurrencePreview[] {
  const reference = options?.reference ?? new Date();
  const limitPerEvent = options?.limitPerEvent ?? 3;
  const refMs = reference.getTime();
  const idSet = new Set(eventIds);
  const byEvent = new Map<string, EventDate[]>();

  for (const ed of GLOBAL_EVENT_DATES) {
    if (!idSet.has(ed.eventId)) {
      continue;
    }
    if (new Date(ed.start_datetime).getTime() < refMs) {
      continue;
    }
    if (!byEvent.has(ed.eventId)) {
      byEvent.set(ed.eventId, []);
    }
    byEvent.get(ed.eventId)!.push(ed);
  }

  const out: CatalogOccurrencePreview[] = [];
  for (const eventId of eventIds) {
    const event = getEventById(eventId);
    if (!event) {
      continue;
    }
    const dates = (byEvent.get(eventId) ?? []).toSorted(
      (a, b) =>
        new Date(a.start_datetime).getTime() -
        new Date(b.start_datetime).getTime()
    );
    for (const eventDate of dates.slice(0, limitPerEvent)) {
      const start = new Date(eventDate.start_datetime);
      const end = new Date(eventDate.end_datetime);
      out.push({
        event,
        eventDate,
        rangeLabel: formatEventDateRange(start, end),
      });
    }
  }
  return out;
}

export function groupUpcomingByStartDay(
  rows: UpcomingOccurrenceRow[],
  reference: Date
): UpcomingDayGroup[] {
  const map = new Map<string, UpcomingOccurrenceRow[]>();
  for (const row of rows) {
    const key = row.displayDayKey;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(row);
  }
  const keys = [...map.keys()].toSorted();
  const todayKey = nyYmd(reference);
  const referenceYear = Number(todayKey.slice(0, 4));
  const segmentOrder: Record<ListSegment, number> = {
    single: 0,
    'multi-start': 1,
    'multi-end': 2,
  };
  return keys.map((dateKey) => ({
    dateKey,
    isToday: dateKey === todayKey,
    headingLabel:
      dateKey === todayKey
        ? 'Today'
        : formatCalendarDayHeading(dateKey, referenceYear),
    rows: [...map.get(dateKey)!].toSorted((a, b) => {
      const t = a.start.getTime() - b.start.getTime();
      if (t !== 0) {
        return t;
      }
      return segmentOrder[a.listSegment] - segmentOrder[b.listSegment];
    }),
  }));
}
