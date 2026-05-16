import { describe, expect, it } from 'vitest';
import {
  buildPavilionReservationWeekCalendarSegments,
  listPavilionReservationWeekDates,
} from '@/libs/mit-sailing/pavilionReservationCalendarSegments';

describe('pavilionReservationCalendarSegments', () => {
  it('lists seven dates from the week start', () => {
    expect(listPavilionReservationWeekDates('2026-07-05')).toEqual([
      '2026-07-05',
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
      '2026-07-11',
    ]);
  });

  it('splits cross-midnight reservations into week day segments', () => {
    const segments = buildPavilionReservationWeekCalendarSegments({
      weekStartDate: '2026-07-01',
      slots: [
        {
          id: 'slot-1',
          requestId: 'request-1',
          itemId: 'pavilion',
          date: '2026-07-01',
          startMinutes: 23 * 60,
          endMinutes: 25 * 60 + 30,
          status: 'needs_info',
        },
      ],
    });

    expect(segments).toEqual([
      {
        slotId: 'slot-1',
        requestId: 'request-1',
        itemId: 'pavilion',
        status: 'needs_info',
        conflictSeverity: 'hard',
        date: '2026-07-01',
        startMinutes: 23 * 60,
        endMinutes: 24 * 60,
        startsBeforeDay: false,
        endsAfterDay: true,
      },
      {
        slotId: 'slot-1',
        requestId: 'request-1',
        itemId: 'pavilion',
        status: 'needs_info',
        conflictSeverity: 'hard',
        date: '2026-07-02',
        startMinutes: 0,
        endMinutes: 90,
        startsBeforeDay: true,
        endsAfterDay: false,
      },
    ]);
  });
});
