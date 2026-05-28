import type { SailingAffiliation } from '@/generated/prisma/enums';
import {
  getSailingAffiliationOptions,
  getSailingAffiliationRule,
} from '@/libs/mit-sailing/sailingAffiliations';
import type {
  SailingCardOnboardingFormState,
  SailingCardOnboardingFormValues,
} from '@/libs/mit-sailing/sailingCardOnboardingActions';

type SailingCardOnboardingField =
  keyof SailingCardOnboardingFormState['fieldErrors'];

const optionalMitIdHasValue = (props: {
  readonly mitIdValue: string | undefined;
  readonly mitIdMode: string;
}) => props.mitIdMode === 'optional' && (props.mitIdValue ?? '').trim() !== '';

export const fieldErrorId = (field: SailingCardOnboardingField) =>
  `sailing-card-onboarding-${field}-error`;

const isVisibleSailingAffiliation = (
  value: string
): value is SailingAffiliation =>
  getSailingAffiliationOptions().some((option) => option.value === value);

export const getVisibleSailingAffiliation = (
  value: string | undefined
): SailingAffiliation | '' => {
  if (value === undefined) {
    return '';
  }
  if (!isVisibleSailingAffiliation(value)) {
    return '';
  }
  return value;
};

export const getVisibleSailingAffiliationRule = (
  affiliation: SailingAffiliation | ''
) => {
  if (affiliation === '') {
    return null;
  }
  return getSailingAffiliationRule(affiliation);
};

export const showMitIdForRule = (
  rule: ReturnType<typeof getVisibleSailingAffiliationRule>
) => rule !== null && rule.mitIdMode !== 'hidden';

export const showManualNameForRule = (props: {
  readonly lockedIdentity: boolean;
  readonly rule: ReturnType<typeof getVisibleSailingAffiliationRule>;
}) => props.rule?.allowManualName === true && !props.lockedIdentity;

export const isManualNameRequired = (props: {
  readonly mitIdValue: string | undefined;
  readonly rule: ReturnType<typeof getVisibleSailingAffiliationRule>;
  readonly showManualName: boolean;
}) => {
  if (props.rule === null || !props.showManualName) {
    return false;
  }
  return !optionalMitIdHasValue({
    mitIdMode: props.rule.mitIdMode,
    mitIdValue: props.mitIdValue,
  });
};

const appendCallbackUrl = (props: {
  readonly callbackUrl?: string;
  readonly formData: FormData;
}) => {
  if (props.callbackUrl) {
    props.formData.set('callbackUrl', props.callbackUrl);
  }
};

const appendSwimAgreement = (props: {
  readonly formData: FormData;
  readonly values: SailingCardOnboardingFormValues;
}) => {
  if (props.values.swimAgreementAccepted) {
    props.formData.set('swimAgreementAccepted', 'on');
  }
};

const appendIdentityFields = (props: {
  readonly formData: FormData;
  readonly rule: ReturnType<typeof getVisibleSailingAffiliationRule>;
  readonly values: SailingCardOnboardingFormValues;
}) => {
  const showMitId = showMitIdForRule(props.rule);
  const showManualName = props.rule?.allowManualName === true;

  props.formData.set('firstName', showManualName ? props.values.firstName : '');
  props.formData.set('lastName', showManualName ? props.values.lastName : '');
  props.formData.set('mitId', showMitId ? props.values.mitId : '');
};

const appendBaseFields = (props: {
  readonly formData: FormData;
  readonly values: SailingCardOnboardingFormValues;
}) => {
  props.formData.set('affiliation', props.values.affiliation);
  props.formData.set('cardType', props.values.cardType);
  props.formData.set('dateOfBirth', props.values.dateOfBirth);
  props.formData.set('emergencyContactName', props.values.emergencyContactName);
  props.formData.set(
    'emergencyContactPhone',
    props.values.emergencyContactPhone
  );
  props.formData.set('hasFitnessMembership', props.values.hasFitnessMembership);
  props.formData.set('phone', props.values.phone);
};

export const formDataFromReactHookFormValues = (props: {
  readonly callbackUrl?: string;
  readonly values: SailingCardOnboardingFormValues;
}) => {
  const formData = new FormData();
  const rule = getVisibleSailingAffiliationRule(
    getVisibleSailingAffiliation(props.values.affiliation)
  );

  appendBaseFields({ formData, values: props.values });
  appendIdentityFields({ formData, rule, values: props.values });
  appendCallbackUrl({ callbackUrl: props.callbackUrl, formData });
  appendSwimAgreement({ formData, values: props.values });

  return formData;
};
