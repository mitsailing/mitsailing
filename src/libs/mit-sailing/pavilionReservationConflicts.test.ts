import { describe, expect, it } from 'vitest';
import {
  getPavilionReservationAdminConflictSeverity,
  isPavilionReservationGuestBlockingStatus,
  listPavilionReservationConflicts,
} from '@/libs/mit-sailing/pavilionReservationConflicts';

describe('pavilionReservationConflicts', () => {
  it('blocks guests for needs-info and approved reservations', () => {
    expect(isPavilionReservationGuestBlockingStatus('needs_info')).toBe(true);
    expect(isPavilionReservationGuestBlockingStatus('approved')).toBe(true);
    expect(isPavilionReservationGuestBlockingStatus('pending')).toBe(false);
  });

  it('classifies admin conflicts by status', () => {
    expect(getPavilionReservationAdminConflictSeverity('approved')).toBe(
      'hard'
    );
    expect(getPavilionReservationAdminConflictSeverity('needs_info')).toBe(
      'hard'
    );
    expect(getPavilionReservationAdminConflictSeverity('pending')).toBe('soft');
    expect(getPavilionReservationAdminConflictSeverity('declined')).toBe(
      'none'
    );
    expect(getPavilionReservationAdminConflictSeverity('cancelled')).toBe(
      'none'
    );
    expect(getPavilionReservationAdminConflictSeverity('draft')).toBe('none');
  });

  it('lists overlapping hard and soft conflicts for the same item', () => {
    const conflicts = listPavilionReservationConflicts({
      candidate: {
        itemId: 'pavilion',
        date: '2026-07-01',
        startMinutes: 10 * 60,
        endMinutes: 12 * 60,
      },
      slots: [
        {
          requestId: 'request-approved',
          itemId: 'pavilion',
          date: '2026-07-01',
          startMinutes: 11 * 60,
          endMinutes: 13 * 60,
          status: 'approved',
        },
        {
          requestId: 'request-pending',
          itemId: 'pavilion',
          date: '2026-07-01',
          startMinutes: 9 * 60,
          endMinutes: 10 * 60 + 30,
          status: 'pending',
        },
        {
          requestId: 'request-cancelled',
          itemId: 'pavilion',
          date: '2026-07-01',
          startMinutes: 10 * 60,
          endMinutes: 12 * 60,
          status: 'cancelled',
        },
        {
          requestId: 'request-service',
          itemId: 'cleanup',
          date: '2026-07-01',
          startMinutes: 10 * 60,
          endMinutes: 12 * 60,
          status: 'approved',
        },
      ],
    });

    expect(conflicts.map((conflict) => conflict.requestId)).toEqual([
      'request-approved',
      'request-pending',
    ]);
  });
});
