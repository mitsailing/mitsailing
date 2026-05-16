import {
  addPavilionReservationCalendarDays,
  comparePavilionReservationCalendarDates,
  pavilionReservationLogicalRangeFromSlot,
} from '@/libs/mit-sailing/pavilionReservationBookingTimeline';
import { getPavilionReservationAdminConflictSeverity } from '@/libs/mit-sailing/pavilionReservationConflicts';
import type { PavilionReservationAdminConflictSeverity } from '@/libs/mit-sailing/pavilionReservationConflicts';
import type {
  PavilionReservationSlotInput,
  PavilionReservationStatusValue,
} from '@/libs/mit-sailing/pavilionReservationTypes';

const minutesPerDay = 24 * 60;

export type PavilionReservationCalendarSlot = PavilionReservationSlotInput & {
  id: string;
  requestId: string;
  status: PavilionReservationStatusValue;
};

type PavilionReservationWeekCalendarSegment = {
  slotId: string;
  requestId: string;
  itemId: string;
  status: PavilionReservationStatusValue;
  conflictSeverity: PavilionReservationAdminConflictSeverity;
  date: string;
  startMinutes: number;
  endMinutes: number;
  startsBeforeDay: boolean;
  endsAfterDay: boolean;
};

export function listPavilionReservationWeekDates(weekStartDate: string) {
  const dates: string[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addPavilionReservationCalendarDays(weekStartDate, offset);
    if (!date) {
      return [];
    }
    dates.push(date);
  }
  return dates;
}

export function buildPavilionReservationWeekCalendarSegments(props: {
  weekStartDate: string;
  slots: readonly PavilionReservationCalendarSlot[];
}) {
  const weekDates = listPavilionReservationWeekDates(props.weekStartDate);
  const segments: PavilionReservationWeekCalendarSegment[] = [];

  for (const slot of props.slots) {
    const range = pavilionReservationLogicalRangeFromSlot(slot);
    if (!range) {
      continue;
    }

    for (const date of weekDates) {
      const dayOffset = comparePavilionReservationCalendarDates(
        date,
        slot.date
      );
      if (dayOffset === null) {
        continue;
      }

      const dayStartTotalMinutes =
        range.startTotalMinutes - slot.startMinutes + dayOffset * minutesPerDay;
      const dayEndTotalMinutes = dayStartTotalMinutes + minutesPerDay;
      const startTotalMinutes = Math.max(
        range.startTotalMinutes,
        dayStartTotalMinutes
      );
      const endTotalMinutes = Math.min(
        range.endTotalMinutes,
        dayEndTotalMinutes
      );

      if (startTotalMinutes >= endTotalMinutes) {
        continue;
      }

      segments.push({
        slotId: slot.id,
        requestId: slot.requestId,
        itemId: slot.itemId,
        status: slot.status,
        conflictSeverity: getPavilionReservationAdminConflictSeverity(
          slot.status
        ),
        date,
        startMinutes: startTotalMinutes - dayStartTotalMinutes,
        endMinutes: endTotalMinutes - dayStartTotalMinutes,
        startsBeforeDay: startTotalMinutes > range.startTotalMinutes,
        endsAfterDay: endTotalMinutes < range.endTotalMinutes,
      });
    }
  }

  return segments.toSorted((first, second) => {
    const dateOrder = first.date.localeCompare(second.date);
    if (dateOrder !== 0) {
      return dateOrder;
    }
    return first.startMinutes - second.startMinutes;
  });
}
