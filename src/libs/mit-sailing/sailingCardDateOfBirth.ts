import { calendarYearInEventsTimeZone } from '@/lib/mit-sailing/nyTime';

const isoDateOfBirthPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const numericDateOfBirthPattern = /^(\d{2})(\d{2})(\d{4})$/;
const numericShortDateOfBirthPattern = /^(\d{2})(\d{2})(\d{2})$/;
const slashDateOfBirthPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const slashShortDateOfBirthPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/;

/**
 * Expands a two-digit birth year into the New York current or previous century.
 *
 * @param props - Current date and two-digit year string to expand.
 * @returns Four-digit year string; for example, "88" in 2026 becomes "1988".
 */
const expandShortBirthYear = (props: {
  readonly now: Date;
  readonly year: string;
}) => {
  const shortYear = Number(props.year);
  const currentYear = calendarYearInEventsTimeZone(props.now);
  const currentCentury = Math.floor(currentYear / 100) * 100;
  const expandedYear = currentCentury + shortYear;

  return expandedYear > currentYear
    ? (expandedYear - 100).toString()
    : expandedYear.toString();
};

const dateFromParts = (props: {
  readonly day: string;
  readonly month: string;
  readonly year: string;
}) => {
  const year = Number(props.year);
  const month = Number(props.month);
  const day = Number(props.day);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

const dateFromMatch = (props: {
  readonly dayIndex: number;
  readonly match: RegExpExecArray | null;
  readonly monthIndex: number;
  readonly now: Date;
  readonly shortYear?: boolean;
  readonly yearIndex: number;
}) => {
  const day = props.match?.[props.dayIndex];
  const month = props.match?.[props.monthIndex];
  const year = props.match?.[props.yearIndex];

  if (day === undefined || month === undefined || year === undefined) {
    return null;
  }

  return dateFromParts({
    day,
    month,
    year:
      props.shortYear === true
        ? expandShortBirthYear({ now: props.now, year })
        : year,
  });
};

const formatDateOfBirth = (date: Date) =>
  [
    (date.getUTCMonth() + 1).toString().padStart(2, '0'),
    date.getUTCDate().toString().padStart(2, '0'),
    date.getUTCFullYear().toString(),
  ].join('/');

export const parseSailingCardDateOfBirth = (props: {
  readonly allowIsoDate?: boolean;
  readonly now?: Date;
  readonly value: string | undefined;
}) => {
  const trimmed = (props.value ?? '').trim();
  const now = props.now ?? new Date();
  const isoDate =
    props.allowIsoDate === true
      ? dateFromMatch({
          dayIndex: 3,
          match: isoDateOfBirthPattern.exec(trimmed),
          monthIndex: 2,
          now,
          yearIndex: 1,
        })
      : null;

  return (
    isoDate ??
    dateFromMatch({
      dayIndex: 2,
      match: slashDateOfBirthPattern.exec(trimmed),
      monthIndex: 1,
      now,
      yearIndex: 3,
    }) ??
    dateFromMatch({
      dayIndex: 2,
      match: slashShortDateOfBirthPattern.exec(trimmed),
      monthIndex: 1,
      now,
      shortYear: true,
      yearIndex: 3,
    }) ??
    dateFromMatch({
      dayIndex: 2,
      match: numericDateOfBirthPattern.exec(trimmed),
      monthIndex: 1,
      now,
      yearIndex: 3,
    }) ??
    dateFromMatch({
      dayIndex: 2,
      match: numericShortDateOfBirthPattern.exec(trimmed),
      monthIndex: 1,
      now,
      shortYear: true,
      yearIndex: 3,
    })
  );
};

export const formatSailingCardDateOfBirthInput = (value: string) => {
  const trimmed = value.trim();
  if (
    isoDateOfBirthPattern.test(trimmed) ||
    slashDateOfBirthPattern.test(trimmed)
  ) {
    const parsedAutofillDate = parseSailingCardDateOfBirth({
      allowIsoDate: true,
      value: trimmed,
    });

    return parsedAutofillDate === null
      ? trimmed
      : formatDateOfBirth(parsedAutofillDate);
  }

  const digits = value.replaceAll(/\D/g, '').slice(0, 8);
  if (digits.length < 2) {
    return digits;
  }
  if (digits.length < 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  if (digits.length === 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}/`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export const normalizeSailingCardDateOfBirthInput = (props: {
  readonly now?: Date;
  readonly value: string;
}) => {
  const parsedDate = parseSailingCardDateOfBirth({
    allowIsoDate: true,
    now: props.now,
    value: props.value,
  });

  return parsedDate === null
    ? formatSailingCardDateOfBirthInput(props.value)
    : formatDateOfBirth(parsedDate);
};
