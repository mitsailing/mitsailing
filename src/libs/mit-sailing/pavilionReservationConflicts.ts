import {
  pavilionReservationLogicalRangeFromSlot,
  pavilionReservationRangesOverlap,
} from '@/libs/mit-sailing/pavilionReservationBookingTimeline';
import type {
  PavilionReservationSlotInput,
  PavilionReservationStatusValue,
} from '@/libs/mit-sailing/pavilionReservationTypes';

export type PavilionReservationAdminConflictSeverity = 'none' | 'soft' | 'hard';

export type PavilionReservationConflictSlot = PavilionReservationSlotInput & {
  requestId: string;
  status: PavilionReservationStatusValue;
};

export function isPavilionReservationGuestBlockingStatus(
  status: PavilionReservationStatusValue
) {
  return status === 'needs_info' || status === 'approved';
}

export function getPavilionReservationAdminConflictSeverity(
  status: PavilionReservationStatusValue
): PavilionReservationAdminConflictSeverity {
  if (status === 'approved' || status === 'needs_info') {
    return 'hard';
  }
  if (status === 'pending') {
    return 'soft';
  }
  return 'none';
}

function doPavilionReservationSlotsOverlap(
  first: Pick<
    PavilionReservationSlotInput,
    'date' | 'startMinutes' | 'endMinutes'
  >,
  second: Pick<
    PavilionReservationSlotInput,
    'date' | 'startMinutes' | 'endMinutes'
  >
) {
  const firstRange = pavilionReservationLogicalRangeFromSlot(first);
  const secondRange = pavilionReservationLogicalRangeFromSlot(second);
  if (!firstRange || !secondRange) {
    return false;
  }
  return pavilionReservationRangesOverlap(firstRange, secondRange);
}

export function listPavilionReservationConflicts(props: {
  candidate: PavilionReservationSlotInput;
  slots: readonly PavilionReservationConflictSlot[];
}) {
  return props.slots.filter(
    (slot) =>
      slot.itemId === props.candidate.itemId &&
      getPavilionReservationAdminConflictSeverity(slot.status) !== 'none' &&
      doPavilionReservationSlotsOverlap(props.candidate, slot)
  );
}
