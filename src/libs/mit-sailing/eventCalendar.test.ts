import { describe, expect, it } from 'vitest';
import {
  buildEventCalendarOccurrenceRows,
  buildEventCalendarWeeks,
  clampEventCalendarMonth,
  eventCalendarMonthKey,
  eventsCalendarHref,
  parseEventCalendarMonthParam,
} from '@/libs/mit-sailing/eventCalendar';
import type { EventCalendarDate } from '@/libs/mit-sailing/eventCalendar';

const event = {
  id: 'event-1',
  name: 'Spring regatta',
  slug: 'spring-regatta',
  eventCategoryId: 'cat-racing',
  category: {
    id: 'cat-racing',
    name: 'Racing',
  },
};

describe('eventCalendar', () => {
  it('parses valid month parameter', () => {
    expect(
      parseEventCalendarMonthParam(
        '2026-04',
        new Date('2026-05-15T12:00:00.000Z')
      )
    ).toEqual({ year: 2026, month: 4 });
  });

  it('falls back to reference month for invalid parameter', () => {
    expect(
      parseEventCalendarMonthParam(
        '2026-13',
        new Date('2026-05-15T12:00:00.000Z')
      )
    ).toEqual({ year: 2026, month: 5 });
  });

  it('formats month key with padded month', () => {
    expect(eventCalendarMonthKey({ year: 2026, month: 4 })).toBe('2026-04');
  });

  it('clamps month to catalog bounds', () => {
    expect(
      clampEventCalendarMonth(
        { year: 2026, month: 1 },
        { minYear: 2026, minMonth: 3, maxYear: 2026, maxMonth: 6 }
      )
    ).toEqual({ year: 2026, month: 3 });
  });

  it('builds padded calendar weeks', () => {
    const weeks = buildEventCalendarWeeks({ year: 2026, month: 3 });

    expect(weeks).toHaveLength(5);
    expect(weeks[0]?.[0]).toBe('2026-03-01');
    expect(weeks.at(-1)?.at(-1)).toBeNull();
  });

  it('lists start and end rows for multi-day dates', () => {
    const eventDates: EventCalendarDate[] = [
      {
        id: 'date-1',
        startDateTime: new Date('2026-03-07T14:00:00.000Z'),
        endDateTime: new Date('2026-03-08T20:00:00.000Z'),
        event,
      },
    ];

    const rows = buildEventCalendarOccurrenceRows({
      eventDates,
      rangeStartKey: '2026-03-01',
      rangeEndKey: '2026-03-31',
    });

    expect(rows.map((row) => row.listSegment)).toEqual([
      'multi-start',
      'multi-end',
    ]);
    expect(rows.map((row) => row.displayDayKey)).toEqual([
      '2026-03-07',
      '2026-03-08',
    ]);
  });

  it('builds calendar href with category filter', () => {
    expect(eventsCalendarHref({ year: 2026, month: 4 }, 'cat-racing')).toBe(
      '/events/?month=2026-04&category=cat-racing'
    );
  });
});
