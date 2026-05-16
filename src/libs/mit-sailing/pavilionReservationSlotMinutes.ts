import { PAVILION_RESERVATION_END_MINUTES } from '@/libs/mit-sailing/pavilionReservationBookingTimeline';

const MINUTES_PER_DAY = 24 * 60;

/**
 * Whether stored slot minutes satisfy `pavilion_reservation_slots_minutes_check`
 * (start strictly before 26:00, end at most 26:00, end after start).
 *
 * @param props - Stored start and end minutes.
 * @returns True when the range matches the database check.
 */
export function isPavilionReservationStoredSlotRange(props: {
  startMinutes: number;
  endMinutes: number;
}) {
  const { startMinutes, endMinutes } = props;
  return (
    Number.isInteger(startMinutes) &&
    Number.isInteger(endMinutes) &&
    startMinutes >= 0 &&
    startMinutes < PAVILION_RESERVATION_END_MINUTES &&
    endMinutes > 0 &&
    endMinutes <= PAVILION_RESERVATION_END_MINUTES &&
    endMinutes > startMinutes
  );
}

/**
 * Rolls an end time past midnight when it is earlier on the clock than the start.
 *
 * @param rawEndMinutes - End minutes on a 24-hour clock.
 * @param startMinutes - Start minutes on a 24-hour clock.
 * @returns End minutes, including a next-day offset when needed.
 */
export function normalizePavilionReservationSlotEndMinutes(
  rawEndMinutes: number,
  startMinutes: number
) {
  return rawEndMinutes < startMinutes
    ? rawEndMinutes + MINUTES_PER_DAY
    : rawEndMinutes;
}

/**
 * Parses admin or legacy time tokens: raw minutes (`1560`) or `HH:MM` (24-hour clock).
 *
 * @param value - Raw time token from a form or import row.
 * @returns Parsed minutes, or null when the token is invalid.
 */
export function parsePavilionReservationMinutesToken(value: string) {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const minutes = Number.parseInt(trimmed, 10);
    return Number.isInteger(minutes) &&
      minutes >= 0 &&
      minutes <= PAVILION_RESERVATION_END_MINUTES
      ? minutes
      : null;
  }
  const match = /^(\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const hour = Number.parseInt(match[1] ?? '', 10);
  const minute = Number.parseInt(match[2] ?? '', 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

/**
 * Normalizes a raw end minute and returns stored minutes when they satisfy the DB check.
 *
 * @param props - Parsed start minutes and raw end minutes.
 * @returns Stored start/end minutes, or null when the range is invalid.
 */
export function pavilionReservationStoredSlotMinutesFromRaw(props: {
  startMinutes: number;
  rawEndMinutes: number;
}) {
  const endMinutes = normalizePavilionReservationSlotEndMinutes(
    props.rawEndMinutes,
    props.startMinutes
  );
  if (
    !isPavilionReservationStoredSlotRange({
      startMinutes: props.startMinutes,
      endMinutes,
    })
  ) {
    return null;
  }
  return { startMinutes: props.startMinutes, endMinutes };
}

/**
 * Parses start/end tokens and returns stored minutes when they satisfy the DB check.
 *
 * @param props - Start and end time tokens.
 * @returns Stored start/end minutes, or null when tokens or the range are invalid.
 */
export function pavilionReservationStoredSlotMinutesFromTokens(props: {
  startToken: string;
  endToken: string;
}) {
  const startMinutes = parsePavilionReservationMinutesToken(props.startToken);
  const rawEndMinutes = parsePavilionReservationMinutesToken(props.endToken);
  if (startMinutes === null || rawEndMinutes === null) {
    return null;
  }
  return pavilionReservationStoredSlotMinutesFromRaw({
    startMinutes,
    rawEndMinutes,
  });
}
