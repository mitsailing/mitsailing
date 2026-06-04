import { describe, expect, it } from 'vitest';
import { LearnToSailManagedClassKind } from '@/generated/prisma/enums';
import {
  buildEventCalendarOccurrenceRows,
  buildEventCalendarWeeks,
  addEventCalendarMonths,
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
  learnToSailManagedClassKind: LearnToSailManagedClassKind.none,
  category: {
    id: 'cat-racing',
    name: 'Racing',
    accentClassName: 'bg-mit-red',
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

  it('falls back to reference month when year is out of range', () => {
    expect(
      parseEventCalendarMonthParam(
        '0000-01',
        new Date('2026-05-15T12:00:00.000Z')
      )
    ).toEqual({ year: 2026, month: 5 });
  });

  it('formats month key with padded month', () => {
    expect(eventCalendarMonthKey({ year: 2026, month: 4 })).toBe('2026-04');
  });

  it('normalizes negative month offsets across year boundary', () => {
    expect(addEventCalendarMonths({ year: 2026, month: 3 }, -3)).toEqual({
      year: 2025,
      month: 12,
    });
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

  it('lists ongoing rows for intermediate multi-day dates', () => {
    const eventDates: EventCalendarDate[] = [
      {
        id: 'date-1',
        startDateTime: new Date('2026-03-07T14:00:00.000Z'),
        endDateTime: new Date('2026-03-10T20:00:00.000Z'),
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
      'ongoing',
      'ongoing',
      'multi-end',
    ]);
    expect(rows.map((row) => row.displayDayKey)).toEqual([
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
    ]);
  });

  it('lists ongoing rows for dates spanning the full range', () => {
    const eventDates: EventCalendarDate[] = [
      {
        id: 'date-1',
        startDateTime: new Date('2026-02-27T14:00:00.000Z'),
        endDateTime: new Date('2026-04-02T20:00:00.000Z'),
        event,
      },
    ];

    const rows = buildEventCalendarOccurrenceRows({
      eventDates,
      rangeStartKey: '2026-03-01',
      rangeEndKey: '2026-03-03',
    });

    expect(rows.map((row) => row.listSegment)).toEqual([
      'ongoing',
      'ongoing',
      'ongoing',
    ]);
    expect(rows.map((row) => row.displayDayKey)).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
    ]);
  });

  it('orders same-day rows by list segment before start instant', () => {
    const longEvent = { ...event, id: 'event-long', slug: 'long-series' };
    const eventDates: EventCalendarDate[] = [
      {
        id: 'date-long',
        startDateTime: new Date('2026-03-01T10:00:00.000Z'),
        endDateTime: new Date('2026-03-31T20:00:00.000Z'),
        event: longEvent,
      },
      {
        id: 'date-single',
        startDateTime: new Date('2026-03-15T14:00:00.000Z'),
        endDateTime: new Date('2026-03-15T18:00:00.000Z'),
        event,
      },
    ];

    const rows = buildEventCalendarOccurrenceRows({
      eventDates,
      rangeStartKey: '2026-03-15',
      rangeEndKey: '2026-03-15',
    });

    expect(rows.map((row) => row.listSegment)).toEqual(['single', 'ongoing']);
    expect(rows.map((row) => row.displayDayKey)).toEqual([
      '2026-03-15',
      '2026-03-15',
    ]);
  });

  it('builds calendar href with category filter', () => {
    expect(eventsCalendarHref({ year: 2026, month: 4 }, 'cat-racing')).toBe(
      '/events/?month=2026-04&category=cat-racing'
    );
  });
});
