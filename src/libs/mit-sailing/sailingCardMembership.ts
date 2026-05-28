import { SailingAffiliation, SailingCardType } from '@/generated/prisma/enums';

const studentAffiliations: ReadonlySet<SailingAffiliation> = new Set([
  SailingAffiliation.MIT_STUDENT,
  SailingAffiliation.WELLESLEY,
  SailingAffiliation.BRANDEIS,
  SailingAffiliation.NORTHEASTERN,
  SailingAffiliation.WINSOR,
  SailingAffiliation.BROOKS,
  SailingAffiliation.NROTC,
  SailingAffiliation.OTHER_STUDENT,
]);

const typedDateOfBirthPattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;

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

const isStudentSailingAffiliation = (affiliation: SailingAffiliation | '') =>
  affiliation !== '' && studentAffiliations.has(affiliation);

export const hasAutomaticFitnessMembership = (
  affiliation: SailingAffiliation | ''
) => affiliation === SailingAffiliation.MIT_STUDENT;

export const needsFitnessMembershipQuestion = (
  affiliation: SailingAffiliation | ''
) => affiliation !== '' && !hasAutomaticFitnessMembership(affiliation);

const parseTypedDateOfBirth = (value: string | undefined) => {
  const trimmed = (value ?? '').trim();
  const slashMatch = typedDateOfBirthPattern.exec(trimmed);
  if (slashMatch?.[1] && slashMatch[2] && slashMatch[3]) {
    return dateFromParts({
      day: slashMatch[2],
      month: slashMatch[1],
      year: slashMatch[3],
    });
  }

  const numericMatch = /^(\d{2})(\d{2})(\d{4})$/.exec(trimmed);
  if (numericMatch?.[1] && numericMatch[2] && numericMatch[3]) {
    return dateFromParts({
      day: numericMatch[2],
      month: numericMatch[1],
      year: numericMatch[3],
    });
  }

  return null;
};

const ageOnDate = (props: {
  readonly birthDate: Date;
  readonly onDate: Date;
}) => {
  const onDateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(props.onDate);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(onDateParts.find((p) => p.type === type)?.value ?? 0);
  const onYear = get('year');
  const onMonth = get('month');
  const onDay = get('day');

  const yearDifference = onYear - props.birthDate.getUTCFullYear();
  const hasHadBirthday =
    onMonth > props.birthDate.getUTCMonth() + 1 ||
    (onMonth === props.birthDate.getUTCMonth() + 1 &&
      onDay >= props.birthDate.getUTCDate());

  return hasHadBirthday ? yearDifference : yearDifference - 1;
};

function isSpringOnly(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const month = get('month');
  const day = get('day');

  return month < 7 || (month === 7 && day < 15);
}

function nonStudentRacingPriceCents(props: {
  readonly dateOfBirth: string | undefined;
  readonly now: Date;
}) {
  const birthDate = parseTypedDateOfBirth(props.dateOfBirth);
  if (birthDate === null) {
    return null;
  }

  const thirtyOrOlder = ageOnDate({ birthDate, onDate: props.now }) >= 30;
  if (isSpringOnly(props.now)) {
    return thirtyOrOlder ? 10_000 : 7000;
  }

  return thirtyOrOlder ? 17_500 : 12_500;
}

function nonStudentTeamRacingPriceCents(props: {
  readonly dateOfBirth: string | undefined;
  readonly now: Date;
}) {
  const birthDate = parseTypedDateOfBirth(props.dateOfBirth);
  if (birthDate === null) {
    return null;
  }

  return ageOnDate({ birthDate, onDate: props.now }) >= 30 ? 10_000 : 7000;
}

export const sailingCardMembershipPriceCents = (props: {
  readonly affiliation: SailingAffiliation | '';
  readonly cardType: SailingCardType;
  readonly dateOfBirth: string | undefined;
  readonly now: Date;
}) => {
  if (props.cardType === SailingCardType.normal) {
    return 0;
  }

  const student = isStudentSailingAffiliation(props.affiliation);
  if (props.affiliation === SailingAffiliation.MIT_STUDENT) {
    return 0;
  }
  if (props.cardType === SailingCardType.team_racing) {
    return student ? 2500 : nonStudentTeamRacingPriceCents(props);
  }
  if (student) {
    return isSpringOnly(props.now) ? 2500 : 4000;
  }

  return nonStudentRacingPriceCents(props);
};
