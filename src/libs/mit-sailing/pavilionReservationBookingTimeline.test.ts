import { describe, expect, it } from 'vitest';
import {
  listPavilionReservationTimeOptions,
  pavilionReservationLogicalRangeFromSlot,
  pavilionReservationRangesOverlap,
} from '@/libs/mit-sailing/pavilionReservationBookingTimeline';

describe('pavilionReservationBookingTimeline', () => {
  it('lists half-hour options from morning through next-day closing', () => {
    const options = listPavilionReservationTimeOptions();

    expect(options[0]).toEqual({ minutes: 7 * 60, label: '7:00 AM' });
    expect(options.at(-1)).toEqual({
      minutes: 26 * 60,
      label: '2:00 AM (next day)',
    });
    expect(options).toHaveLength(39);
  });

  it('converts cross-midnight slots to logical ranges', () => {
    const range = pavilionReservationLogicalRangeFromSlot({
      date: '2026-07-01',
      startMinutes: 23 * 60,
      endMinutes: 25 * 60 + 30,
    });

    expect(range?.start).toEqual({ date: '2026-07-01', minutes: 23 * 60 });
    expect(range?.end).toEqual({ date: '2026-07-02', minutes: 90 });
  });

  it('detects overlaps across midnight', () => {
    const first = pavilionReservationLogicalRangeFromSlot({
      date: '2026-07-01',
      startMinutes: 23 * 60,
      endMinutes: 25 * 60,
    });
    const second = pavilionReservationLogicalRangeFromSlot({
      date: '2026-07-02',
      startMinutes: 7 * 60,
      endMinutes: 8 * 60,
    });
    const sameNight = pavilionReservationLogicalRangeFromSlot({
      date: '2026-07-01',
      startMinutes: 24 * 60 + 30,
      endMinutes: 26 * 60,
    });

    expect(
      first && second && pavilionReservationRangesOverlap(first, second)
    ).toBe(false);
    expect(
      first && sameNight && pavilionReservationRangesOverlap(first, sameNight)
    ).toBe(true);
  });
});
