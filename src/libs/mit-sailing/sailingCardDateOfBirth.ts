const isoDateOfBirthPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const numericDateOfBirthPattern = /^(\d{2})(\d{2})(\d{4})$/;
const slashDateOfBirthPattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;

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

export const parseSailingCardDateOfBirth = (props: {
  readonly allowIsoDate?: boolean;
  readonly value: string | undefined;
}) => {
  const trimmed = (props.value ?? '').trim();
  const isoMatch = props.allowIsoDate
    ? isoDateOfBirthPattern.exec(trimmed)
    : null;
  if (isoMatch?.[1] && isoMatch[2] && isoMatch[3]) {
    return dateFromParts({
      day: isoMatch[3],
      month: isoMatch[2],
      year: isoMatch[1],
    });
  }

  const slashMatch = slashDateOfBirthPattern.exec(trimmed);
  if (slashMatch?.[1] && slashMatch[2] && slashMatch[3]) {
    return dateFromParts({
      day: slashMatch[2],
      month: slashMatch[1],
      year: slashMatch[3],
    });
  }

  const numericMatch = numericDateOfBirthPattern.exec(trimmed);
  if (numericMatch?.[1] && numericMatch[2] && numericMatch[3]) {
    return dateFromParts({
      day: numericMatch[2],
      month: numericMatch[1],
      year: numericMatch[3],
    });
  }

  return null;
};
