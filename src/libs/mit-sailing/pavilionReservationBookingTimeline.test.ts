import { describe, expect, it } from 'vitest';
import {
  buildPavilionReservationTimeSelectOptions,
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

  it('builds start select options without the closing instant', () => {
    const options = buildPavilionReservationTimeSelectOptions({});

    expect(options.at(-1)?.minutes).toBe(25 * 60 + 30);
    expect(options).toHaveLength(38);
  });

  it('preserves off-grid minutes in select options', () => {
    const options = buildPavilionReservationTimeSelectOptions({
      preserveMinutes: 9 * 60 + 15,
      preserveLabel: (minutes) => `legacy ${minutes}`,
    });

    expect(options[0]).toEqual({
      minutes: 9 * 60 + 15,
      label: `legacy ${9 * 60 + 15}`,
    });
    expect(options.some((option) => option.minutes === 9 * 60 + 15)).toBe(true);
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
