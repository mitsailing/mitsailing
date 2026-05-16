import { formatPavilionReservationTimeLabel } from '@/libs/mit-sailing/pavilionReservationTimeLabel';
import type { PavilionReservationSlotInput } from '@/libs/mit-sailing/pavilionReservationTypes';

/** First bookable minute on the pavilion day axis (7:00 AM). */
export const PAVILION_RESERVATION_START_MINUTES = 7 * 60;
/**
 * Last bookable minute on the pavilion timeline. `26 * 60` is 26:00 on the
 * booking-day axis (2:00 AM the following calendar day).
 * `logicalInstantFromDayNumber` rolls to the next date via `dayOffset` when
 * minutes exceed one day.
 */
export const PAVILION_RESERVATION_END_MINUTES = 26 * 60;
/** Half-hour grid for bookable start and end times. */
const PAVILION_RESERVATION_MIN_GRID = 30;

const minutesPerDay = 24 * 60;

export type PavilionReservationTimeOption = {
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
    minutes += PAVILION_RESERVATION_MIN_GRID
  ) {
    options.push({
      minutes,
      label: formatPavilionReservationTimeLabel(minutes),
    });
  }
  return options;
}

/**
 * Pavilion time options for HTML selects: grid-aligned choices plus an optional
 * preserved value when legacy data is not on the half-hour grid.
 *
 * @param props - Select option builder inputs.
 * @param props.includeEnd - When true, include the closing instant (26:00).
 * @param props.preserveMinutes - Off-grid value to keep selectable without coercion.
 * @param props.preserveLabel - Label for the preserved option; defaults to formatted time.
 * @returns Grid-aligned options, with a leading preserved value when needed.
 */
export function buildPavilionReservationTimeSelectOptions(props: {
  includeEnd?: boolean;
  preserveMinutes?: number;
  preserveLabel?: (minutes: number) => string;
}) {
  const gridOptions = listPavilionReservationTimeOptions().filter(
    (option) =>
      props.includeEnd === true ||
      option.minutes < PAVILION_RESERVATION_END_MINUTES
  );
  const preserve = props.preserveMinutes;
  if (
    preserve !== undefined &&
    !gridOptions.some((option) => option.minutes === preserve)
  ) {
    const formatLabel =
      props.preserveLabel ?? formatPavilionReservationTimeLabel;
    return [
      { minutes: preserve, label: formatLabel(preserve) },
      ...gridOptions,
    ];
  }
  return gridOptions;
}

/**
 * Returns whether `minutes` is on the pavilion operating-hours grid.
 *
 * @param minutes - Minutes from midnight on the booking-day axis.
 * @returns True when within operating hours on the half-hour grid.
 */
export function isPavilionReservationTimelineMinutes(minutes: number) {
  return (
    Number.isInteger(minutes) &&
    minutes >= 0 &&
    minutes >= PAVILION_RESERVATION_START_MINUTES &&
    minutes <= PAVILION_RESERVATION_END_MINUTES &&
    (minutes - PAVILION_RESERVATION_START_MINUTES) %
      PAVILION_RESERVATION_MIN_GRID ===
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
