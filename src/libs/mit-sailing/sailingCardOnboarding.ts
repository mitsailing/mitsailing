import {
  MitDataWarehousePersonType,
  SailingAffiliation,
} from '@/generated/prisma/enums';
import type { SailingCardType } from '@/generated/prisma/enums';
import type { MitDataWarehouseIdentity } from '@/libs/mit-sailing/mitDataWarehouse';
import { normalizeMitId } from '@/libs/mit-sailing/mitDataWarehouse';
import {
  normalizeManualPersonName,
  normalizeVerifiedMitDataWarehousePersonName,
} from '@/libs/mit-sailing/personName';
import {
  getSailingAffiliationOptions,
  getSailingAffiliationRule,
} from '@/libs/mit-sailing/sailingAffiliations';
import {
  normalizeInternationalPhone,
  normalizeUsPhone,
} from '@/utils/phoneValidation';

export type SailingCardOnboardingInput = {
  readonly affiliation: SailingAffiliation | null;
  readonly cardType: SailingCardType | null;
  readonly dateOfBirth: string;
  readonly emergencyContactName: string;
  readonly emergencyContactPhone: string;
  readonly mitId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly swimAgreementAccepted: boolean;
};

export type SailingCardOnboardingFieldError =
  | 'affiliation_mismatch'
  | 'invalid'
  | 'invalid_dw_identity'
  | 'required'
  | 'required_dw_identity';

type SailingCardOnboardingFieldName =
  | keyof SailingCardOnboardingInput
  | 'swimAgreementInitials';

export type SailingCardOnboardingFieldErrors = Partial<
  Record<SailingCardOnboardingFieldName, SailingCardOnboardingFieldError>
>;

export class SailingCardOnboardingValidationError extends Error {
  readonly fieldErrors: SailingCardOnboardingFieldErrors;

  constructor(fieldErrors: SailingCardOnboardingFieldErrors) {
    super('Invalid sailing-card onboarding submission.');
    this.name = 'SailingCardOnboardingValidationError';
    this.fieldErrors = fieldErrors;
  }
}

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

const parseDateOfBirth = (value: string) => {
  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch?.[1] && isoMatch[2] && isoMatch[3]) {
    return dateFromParts({
      day: isoMatch[3],
      month: isoMatch[2],
      year: isoMatch[1],
    });
  }

  const slashMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
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

const validateContact = (input: SailingCardOnboardingInput) => {
  const fieldErrors: SailingCardOnboardingFieldErrors = {};
  const phone = normalizeUsPhone(input.phone);
  const emergencyContactName = input.emergencyContactName.trim();
  const emergencyContactPhone = normalizeInternationalPhone(
    input.emergencyContactPhone
  );

  if (!phone.ok) {
    fieldErrors.phone = 'invalid';
  }
  if (emergencyContactName === '') {
    fieldErrors.emergencyContactName = 'required';
  }
  if (input.emergencyContactPhone.trim() === '') {
    fieldErrors.emergencyContactPhone = 'required';
  } else if (!emergencyContactPhone.ok) {
    fieldErrors.emergencyContactPhone = 'invalid';
  }
  if (
    Object.keys(fieldErrors).length > 0 ||
    !phone.ok ||
    !emergencyContactPhone.ok
  ) {
    throw new SailingCardOnboardingValidationError(fieldErrors);
  }

  return {
    emergencyContactName,
    emergencyContactPhone: emergencyContactPhone.phone,
    phone: phone.phone,
  };
};

const validateRequiredInputs = (input: SailingCardOnboardingInput) => {
  const visibleAffiliations: ReadonlySet<SailingAffiliation> = new Set(
    getSailingAffiliationOptions().map((option) => option.value)
  );
  const affiliation =
    input.affiliation !== null && visibleAffiliations.has(input.affiliation)
      ? input.affiliation
      : null;
  const fieldErrors: SailingCardOnboardingFieldErrors = {};
  const contact = validateContact(input);
  const dateOfBirth = parseDateOfBirth(input.dateOfBirth);

  if (affiliation === null) {
    fieldErrors.affiliation = 'required';
  }
  if (input.cardType === null) {
    fieldErrors.cardType = 'required';
  }
  if (dateOfBirth === null) {
    fieldErrors.dateOfBirth = 'required';
  }
  if (!input.swimAgreementAccepted) {
    fieldErrors.swimAgreementAccepted = 'required';
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new SailingCardOnboardingValidationError(fieldErrors);
  }
  if (affiliation === null) {
    throw new SailingCardOnboardingValidationError({
      affiliation: 'required',
    });
  }
  if (input.cardType === null) {
    throw new SailingCardOnboardingValidationError({
      cardType: 'required',
    });
  }
  if (dateOfBirth === null) {
    throw new SailingCardOnboardingValidationError({
      dateOfBirth: 'required',
    });
  }

  return {
    affiliation,
    cardType: input.cardType,
    contact,
    dateOfBirth,
  };
};

const requireMatchingDataWarehouseIdentity = (props: {
  readonly dataWarehouseIdentity: MitDataWarehouseIdentity | null;
  readonly normalizedMitId: string | null;
  readonly missingCode: SailingCardOnboardingFieldError;
}) => {
  if (props.normalizedMitId === null || props.dataWarehouseIdentity === null) {
    throw new SailingCardOnboardingValidationError({
      mitId: props.missingCode,
    });
  }

  if (props.dataWarehouseIdentity.mitId !== props.normalizedMitId) {
    throw new SailingCardOnboardingValidationError({
      mitId: 'invalid_dw_identity',
    });
  }

  return props.dataWarehouseIdentity;
};

const validateRequiredMitAffiliation = (props: {
  readonly affiliation: SailingAffiliation;
  readonly identity: MitDataWarehouseIdentity;
}) => {
  const validStudent =
    props.affiliation === SailingAffiliation.MIT_STUDENT &&
    props.identity.personType === MitDataWarehousePersonType.CURRENT_STUDENT;
  const validStaff =
    (props.affiliation === SailingAffiliation.MIT_FACULTY ||
      props.affiliation === SailingAffiliation.MIT_STAFF) &&
    props.identity.personType === MitDataWarehousePersonType.CURRENT_STAFF;

  if (!validStudent && !validStaff) {
    throw new SailingCardOnboardingValidationError({
      mitId: 'affiliation_mismatch',
    });
  }
};

const requireManualName = (input: SailingCardOnboardingInput) => {
  const personName = normalizeManualPersonName({
    firstName: input.firstName,
    lastName: input.lastName,
  });
  const fieldErrors: SailingCardOnboardingFieldErrors = {};

  if (personName.firstName === '') {
    fieldErrors.firstName = 'required';
  }
  if (personName.lastName === '') {
    fieldErrors.lastName = 'required';
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new SailingCardOnboardingValidationError(fieldErrors);
  }

  return personName;
};

export const buildSailingCardOnboardingUpdate = (props: {
  readonly input: SailingCardOnboardingInput;
  readonly dataWarehouseIdentity: MitDataWarehouseIdentity | null;
  readonly now: Date;
}) => {
  const { affiliation, cardType, contact, dateOfBirth } =
    validateRequiredInputs(props.input);
  const affiliationRule = getSailingAffiliationRule(affiliation);
  const normalizedMitId = normalizeMitId(props.input.mitId);
  const hasMitIdInput = props.input.mitId.trim() !== '';
  const { now } = props;

  let firstName: string;
  let lastName: string;
  let mitId: string | null = null;
  let mitClassYear: string | null = null;
  let mitDataWarehouseVerifiedAt: Date | null = null;

  if (affiliationRule.mitIdMode === 'required') {
    const identity = requireMatchingDataWarehouseIdentity({
      dataWarehouseIdentity: props.dataWarehouseIdentity,
      missingCode: 'required_dw_identity',
      normalizedMitId,
    });
    validateRequiredMitAffiliation({
      affiliation,
      identity,
    });

    const personName = normalizeVerifiedMitDataWarehousePersonName(identity);
    ({ firstName } = personName);
    ({ lastName } = personName);
    ({ mitId } = identity);
    mitClassYear = identity.classYear;
    mitDataWarehouseVerifiedAt = now;
  } else if (affiliationRule.mitIdMode === 'optional' && hasMitIdInput) {
    const identity = requireMatchingDataWarehouseIdentity({
      dataWarehouseIdentity: props.dataWarehouseIdentity,
      missingCode: 'invalid_dw_identity',
      normalizedMitId,
    });

    const personName = normalizeVerifiedMitDataWarehousePersonName(identity);
    ({ firstName } = personName);
    ({ lastName } = personName);
    ({ mitId } = identity);
    mitClassYear = identity.classYear;
    mitDataWarehouseVerifiedAt = now;
  } else {
    ({ firstName, lastName } = requireManualName(props.input));
  }

  return {
    firstName,
    cardType,
    dateOfBirth,
    emergencyContactName: contact.emergencyContactName,
    emergencyContactPhone: contact.emergencyContactPhone,
    lastName,
    name: `${firstName} ${lastName}`,
    phone: contact.phone,
    sailingAffiliation: affiliation,
    mitId,
    mitClassYear,
    mitDataWarehouseVerifiedAt,
    sailingCardRequestedAt: now,
  };
};
