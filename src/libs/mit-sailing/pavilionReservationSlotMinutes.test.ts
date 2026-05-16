import { describe, expect, it } from 'vitest';
import { PAVILION_RESERVATION_END_MINUTES } from '@/libs/mit-sailing/pavilionReservationBookingTimeline';
import {
  isPavilionReservationStoredSlotRange,
  normalizePavilionReservationSlotEndMinutes,
  parsePavilionReservationMinutesToken,
  pavilionReservationStoredSlotMinutesFromTokens,
} from '@/libs/mit-sailing/pavilionReservationSlotMinutes';

describe('parsePavilionReservationMinutesToken', () => {
  it('parses raw minutes and HH:MM tokens', () => {
    expect(parsePavilionReservationMinutesToken('1560')).toBe(1560);
    expect(parsePavilionReservationMinutesToken('23:00')).toBe(23 * 60);
  });

  it('rejects tokens above the closing instant', () => {
    expect(parsePavilionReservationMinutesToken('1561')).toBeNull();
    expect(parsePavilionReservationMinutesToken('27:00')).toBeNull();
  });
});

describe('isPavilionReservationStoredSlotRange', () => {
  it('accepts end at closing boundary but not start', () => {
    expect(
      isPavilionReservationStoredSlotRange({
        startMinutes: PAVILION_RESERVATION_END_MINUTES - 30,
        endMinutes: PAVILION_RESERVATION_END_MINUTES,
      })
    ).toBe(true);
    expect(
      isPavilionReservationStoredSlotRange({
        startMinutes: PAVILION_RESERVATION_END_MINUTES,
        endMinutes: PAVILION_RESERVATION_END_MINUTES,
      })
    ).toBe(false);
  });
});

describe('normalizePavilionReservationSlotEndMinutes', () => {
  it('rolls end past midnight when clock time is before start', () => {
    expect(normalizePavilionReservationSlotEndMinutes(1500, 1380)).toBe(1500);
    expect(normalizePavilionReservationSlotEndMinutes(90, 1380)).toBe(
      90 + 24 * 60
    );
  });
});

describe('pavilionReservationStoredSlotMinutesFromTokens', () => {
  it('rejects start at closing boundary from raw tokens', () => {
    expect(
      pavilionReservationStoredSlotMinutesFromTokens({
        startToken: '1560',
        endToken: '1560',
      })
    ).toBeNull();
  });

  it('accepts cross-midnight admin tokens', () => {
    expect(
      pavilionReservationStoredSlotMinutesFromTokens({
        startToken: '1380',
        endToken: '1500',
      })
    ).toEqual({ startMinutes: 1380, endMinutes: 1500 });
  });
});
