import { describe, expect, it } from 'vitest';
import { formatPavilionReservationTimeLabel } from '@/libs/mit-sailing/pavilionReservationTimeLabel';

describe('formatPavilionReservationTimeLabel', () => {
  it('formats same-day minutes as twelve-hour labels', () => {
    expect(formatPavilionReservationTimeLabel(9 * 60 + 30)).toBe('9:30 AM');
    expect(formatPavilionReservationTimeLabel(12 * 60)).toBe('12:00 PM');
  });

  it('marks next-day minutes after midnight', () => {
    expect(formatPavilionReservationTimeLabel(24 * 60 + 30)).toBe(
      '12:30 AM (next day)'
    );
  });
});
