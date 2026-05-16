import { formatPavilionReservationTimeLabel } from '@/libs/mit-sailing/pavilionReservationTimeLabel';
import type { PavilionReservationSlotInput } from '@/libs/mit-sailing/pavilionReservationTypes';

const PAVILION_RESERVATION_START_MINUTES = 7 * 60;
const PAVILION_RESERVATION_END_MINUTES = 26 * 60;
const PAVILION_RESERVATION_TIME_STEP_MINUTES = 30;

const minutesPerDay = 24 * 60;

type PavilionReservationTimeOption = {
  minutes: number;
  label: string;
};

export type PavilionReservationLogicalInstant = {
  date: string;
  minutes: number;
};

export type PavilionReservationLogicalRange = {
  start: PavilionReservationLogicalInstant;
  end: PavilionReservationLogicalInstant;
  startTotalMinutes: number;
  endTotalMinutes: number;
};

function isoDayNumber(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const [yearText, monthText, dayText] = date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return Math.trunc(parsed.getTime() / 86_400_000);
}

function isoDateFromDayNumber(dayNumber: number) {
  return new Date(dayNumber * 86_400_000).toISOString().slice(0, 10);
}

function logicalInstantFromDayNumber(
  dayNumber: number,
  logicalMinutes: number
): PavilionReservationLogicalInstant {
  const dayOffset = Math.floor(logicalMinutes / minutesPerDay);
  return {
    date: isoDateFromDayNumber(dayNumber + dayOffset),
    minutes: logicalMinutes - dayOffset * minutesPerDay,
  };
}

export function listPavilionReservationTimeOptions() {
  const options: PavilionReservationTimeOption[] = [];
  for (
    let minutes = PAVILION_RESERVATION_START_MINUTES;
    minutes <= PAVILION_RESERVATION_END_MINUTES;
    minutes += PAVILION_RESERVATION_TIME_STEP_MINUTES
  ) {
    options.push({
      minutes,
      label: formatPavilionReservationTimeLabel(minutes),
    });
  }
  return options;
}

function isPavilionReservationTimelineMinutes(minutes: number) {
  return (
    Number.isInteger(minutes) &&
    minutes >= PAVILION_RESERVATION_START_MINUTES &&
    minutes <= PAVILION_RESERVATION_END_MINUTES &&
    (minutes - PAVILION_RESERVATION_START_MINUTES) %
      PAVILION_RESERVATION_TIME_STEP_MINUTES ===
      0
  );
}

export function pavilionReservationLogicalRangeFromSlot(
  slot: Pick<
    PavilionReservationSlotInput,
    'date' | 'startMinutes' | 'endMinutes'
  >
): PavilionReservationLogicalRange | null {
  const dayNumber = isoDayNumber(slot.date);
  if (
    dayNumber === null ||
    !isPavilionReservationTimelineMinutes(slot.startMinutes) ||
    !isPavilionReservationTimelineMinutes(slot.endMinutes) ||
    slot.endMinutes <= slot.startMinutes
  ) {
    return null;
  }

  return {
    start: logicalInstantFromDayNumber(dayNumber, slot.startMinutes),
    end: logicalInstantFromDayNumber(dayNumber, slot.endMinutes),
    startTotalMinutes: dayNumber * minutesPerDay + slot.startMinutes,
    endTotalMinutes: dayNumber * minutesPerDay + slot.endMinutes,
  };
}

export function pavilionReservationRangesOverlap(
  first: PavilionReservationLogicalRange,
  second: PavilionReservationLogicalRange
) {
  return (
    first.startTotalMinutes < second.endTotalMinutes &&
    second.startTotalMinutes < first.endTotalMinutes
  );
}

export function addPavilionReservationCalendarDays(date: string, days: number) {
  const dayNumber = isoDayNumber(date);
  if (dayNumber === null) {
    return null;
  }
  return isoDateFromDayNumber(dayNumber + days);
}

export function comparePavilionReservationCalendarDates(
  first: string,
  second: string
) {
  const firstDay = isoDayNumber(first);
  const secondDay = isoDayNumber(second);
  if (firstDay === null || secondDay === null) {
    return null;
  }
  return firstDay - secondDay;
}
