import {
  MitDataWarehousePersonType,
  SailingAffiliation,
  SailingCardType,
} from '@/generated/prisma/enums';
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
import { parseSailingCardDateOfBirth } from '@/libs/mit-sailing/sailingCardDateOfBirth';
import {
  normalizeInternationalPhone,
  normalizeUsPhone,
} from '@/utils/phoneValidation';
import { needsFitnessMembershipQuestion } from './sailingCardMembership';

export type SailingCardOnboardingInput = {
  readonly affiliation: SailingAffiliation | null;
  readonly cardType: SailingCardType | null;
  readonly dateOfBirth: string;
  readonly emergencyContactName: string;
  readonly emergencyContactPhone: string;
  readonly hasFitnessMembership: boolean | null;
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

type SailingCardOnboardingContact = {
  readonly emergencyContactName: string;
  readonly emergencyContactPhone: string;
  readonly phone: string;
};

type SailingCardOnboardingContactValidation =
  | {
      readonly ok: true;
      readonly contact: SailingCardOnboardingContact;
    }
  | {
      readonly ok: false;
      readonly fieldErrors: SailingCardOnboardingFieldErrors;
    };

export class SailingCardOnboardingValidationError extends Error {
  readonly fieldErrors: SailingCardOnboardingFieldErrors;

  constructor(fieldErrors: SailingCardOnboardingFieldErrors) {
    super('Invalid sailing-card onboarding submission.');
    this.name = 'SailingCardOnboardingValidationError';
    this.fieldErrors = fieldErrors;
  }
}

const persistedFitnessMembership = (props: {
  readonly affiliation: SailingAffiliation;
  readonly hasFitnessMembership: boolean | null;
}) =>
  needsFitnessMembershipQuestion(props.affiliation)
    ? props.hasFitnessMembership
    : null;

const normalizedCardTypeForMembership = (props: {
  readonly affiliation: SailingAffiliation;
  readonly cardType: SailingCardType;
  readonly hasFitnessMembership: boolean | null;
}) => {
  if (
    !needsFitnessMembershipQuestion(props.affiliation) ||
    props.hasFitnessMembership === true
  ) {
    return SailingCardType.normal;
  }

  return props.cardType;
};

const validateContact = (
  input: SailingCardOnboardingInput
): SailingCardOnboardingContactValidation => {
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
    return { fieldErrors, ok: false };
  }

  return {
    contact: {
      emergencyContactName,
      emergencyContactPhone: emergencyContactPhone.phone,
      phone: phone.phone,
    },
    ok: true,
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
  const contactValidation = validateContact(input);
  const dateOfBirth = parseSailingCardDateOfBirth({
    allowIsoDate: true,
    value: input.dateOfBirth,
  });
  const membershipAnswerRequired =
    affiliation !== null && needsFitnessMembershipQuestion(affiliation);

  if (!contactValidation.ok) {
    Object.assign(fieldErrors, contactValidation.fieldErrors);
  }
  if (affiliation === null) {
    fieldErrors.affiliation = 'required';
  }
  if (dateOfBirth === null) {
    fieldErrors.dateOfBirth = 'required';
  }
  if (input.dateOfBirth.trim() !== '' && dateOfBirth === null) {
    fieldErrors.dateOfBirth = 'invalid';
  }
  if (input.cardType === null) {
    fieldErrors.cardType = 'required';
  }
  if (membershipAnswerRequired && input.hasFitnessMembership === null) {
    fieldErrors.hasFitnessMembership = 'required';
  }
  if (!input.swimAgreementAccepted) {
    fieldErrors.swimAgreementAccepted = 'required';
  }
  if (
    Object.keys(fieldErrors).length > 0 ||
    !contactValidation.ok ||
    affiliation === null ||
    (membershipAnswerRequired && input.hasFitnessMembership === null) ||
    input.cardType === null ||
    dateOfBirth === null
  ) {
    throw new SailingCardOnboardingValidationError(fieldErrors);
  }

  return {
    affiliation,
    cardType: normalizedCardTypeForMembership({
      affiliation,
      cardType: input.cardType,
      hasFitnessMembership: input.hasFitnessMembership,
    }),
    contact: contactValidation.contact,
    dateOfBirth,
    hasFitnessMembership: persistedFitnessMembership({
      affiliation,
      hasFitnessMembership: input.hasFitnessMembership,
    }),
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
  const { affiliation, cardType, contact, dateOfBirth, hasFitnessMembership } =
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
    hasFitnessMembership,
    name: `${firstName} ${lastName}`,
    phone: contact.phone,
    sailingAffiliation: affiliation,
    mitId,
    mitClassYear,
    mitDataWarehouseVerifiedAt,
    sailingCardRequestedAt: now,
  };
};
