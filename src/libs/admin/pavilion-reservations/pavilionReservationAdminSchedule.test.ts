import { describe, expect, it, vi } from 'vitest';
import {
  adminPavilionReservationAddDays,
  adminPavilionReservationSlotConflicts,
  adminPavilionReservationWeekKeys,
  buildAdminPavilionReservationConflictGraph,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminSchedule';
import type { AdminPavilionReservationScheduleSlot } from '@/libs/admin/pavilion-reservations/pavilionReservationAdminSchedule';

vi.mock('server-only', () => ({}));

function slot(
  props: Partial<AdminPavilionReservationScheduleSlot>
): AdminPavilionReservationScheduleSlot {
  return {
    id: props.id ?? 'slot-1',
    requestId: props.requestId ?? 'request-1',
    referenceCode: props.referenceCode ?? 'PAV-ONE',
    eventName: props.eventName ?? 'Event',
    status: props.status ?? 'pending',
    paymentStatus: props.paymentStatus ?? 'unpaid',
    itemId: props.itemId ?? 'pavilion',
    itemName: props.itemName ?? 'Pavilion',
    requestedDate: props.requestedDate ?? new Date('2026-05-15T00:00:00Z'),
    startMinutes: props.startMinutes ?? 9 * 60,
    endMinutes: props.endMinutes ?? 11 * 60,
  };
}

describe('pavilionReservationAdminSchedule', () => {
  it('builds soft and hard conflict edges', () => {
    const graph = buildAdminPavilionReservationConflictGraph([
      slot({ requestId: 'pending-a', status: 'pending' }),
      slot({
        id: 'slot-2',
        requestId: 'needs-info-b',
        status: 'needs_info',
        startMinutes: 10 * 60,
        endMinutes: 12 * 60,
      }),
      slot({
        id: 'slot-3',
        requestId: 'approved-c',
        status: 'approved',
        startMinutes: 10 * 60 + 30,
        endMinutes: 12 * 60,
      }),
    ]);

    expect(graph.get('pending-a')?.hard.has('needs-info-b')).toBe(true);
    expect(graph.get('pending-a')?.hard.has('approved-c')).toBe(true);
    expect(graph.get('approved-c')?.hard.has('needs-info-b')).toBe(true);
  });

  it('derives per-slot conflict severity from overlapping slots only', () => {
    const itemId = 'pavilion';
    const date = new Date('2026-05-15T00:00:00Z');
    const scheduleSlots = [
      slot({
        id: 'mine-early',
        requestId: 'mine',
        status: 'pending',
        requestedDate: date,
        startMinutes: 9 * 60,
        endMinutes: 10 * 60,
        itemId,
      }),
      slot({
        id: 'mine-late',
        requestId: 'mine',
        status: 'pending',
        requestedDate: date,
        startMinutes: 14 * 60,
        endMinutes: 16 * 60,
        itemId,
      }),
      slot({
        id: 'other',
        requestId: 'other',
        status: 'approved',
        requestedDate: date,
        startMinutes: 9 * 60 + 30,
        endMinutes: 11 * 60,
        itemId,
      }),
    ];
    const [mineEarly, mineLate] = scheduleSlots;
    if (!mineEarly || !mineLate) {
      throw new Error('Expected schedule slots.');
    }

    expect(
      adminPavilionReservationSlotConflicts(mineEarly, scheduleSlots)
    ).toEqual({
      conflictSeverity: 'hard',
      conflictingRequestIds: ['other'],
    });
    expect(
      adminPavilionReservationSlotConflicts(mineLate, scheduleSlots)
    ).toEqual({
      conflictSeverity: null,
      conflictingRequestIds: [],
    });
  });

  it('builds sunday-based week keys', () => {
    expect(adminPavilionReservationWeekKeys('2026-05-10')).toEqual([
      '2026-05-10',
      '2026-05-11',
      '2026-05-12',
      '2026-05-13',
      '2026-05-14',
      '2026-05-15',
      '2026-05-16',
    ]);
    expect(adminPavilionReservationAddDays('2026-05-10', 7)).toBe('2026-05-17');
  });
});
