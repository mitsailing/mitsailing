import { useTranslations } from 'next-intl';
import type { FieldErrors } from 'react-hook-form';
import type {
  SailingCardOnboardingFormState,
  SailingCardOnboardingFormValues,
} from '@/libs/mit-sailing/sailingCardOnboardingActions';
import { fieldErrorId } from './SailingCardOnboardingFormHelpers';

type SailingCardOnboardingField =
  keyof SailingCardOnboardingFormState['fieldErrors'];

type OnboardingErrorMessageKey =
  | 'error_invalid_date_of_birth'
  | 'error_invalid_emergency_phone'
  | 'error_invalid_phone'
  | 'error_mit_id_affiliation_mismatch'
  | 'error_mit_id_format'
  | 'error_mit_id_invalid_dw_identity'
  | 'error_mit_id_required_dw_identity'
  | 'error_required';

const onboardingErrorMessageKeys = new Set<string>([
  'error_invalid_date_of_birth',
  'error_invalid_emergency_phone',
  'error_invalid_phone',
  'error_mit_id_affiliation_mismatch',
  'error_mit_id_format',
  'error_mit_id_invalid_dw_identity',
  'error_mit_id_required_dw_identity',
  'error_required',
]);

const isOnboardingErrorMessageKey = (
  value: unknown
): value is OnboardingErrorMessageKey =>
  typeof value === 'string' && onboardingErrorMessageKeys.has(value);

const fieldErrorMessageKey = (props: {
  readonly field: SailingCardOnboardingField;
  readonly value:
    | NonNullable<
        SailingCardOnboardingFormState['fieldErrors']
      >[SailingCardOnboardingField]
    | undefined;
}): OnboardingErrorMessageKey => {
  if (props.value === 'required') {
    return 'error_required';
  }
  if (props.field === 'dateOfBirth') {
    return 'error_invalid_date_of_birth';
  }
  if (props.field === 'phone') {
    return 'error_invalid_phone';
  }
  if (props.field === 'emergencyContactPhone') {
    return 'error_invalid_emergency_phone';
  }
  if (props.value === 'affiliation_mismatch') {
    return 'error_mit_id_affiliation_mismatch';
  }
  if (props.value === 'invalid_dw_identity') {
    return 'error_mit_id_invalid_dw_identity';
  }
  return 'error_mit_id_required_dw_identity';
};

const clientErrorMessage = (props: {
  readonly clientErrors:
    | FieldErrors<SailingCardOnboardingFormValues>
    | undefined;
  readonly field: SailingCardOnboardingField;
}) => {
  if (props.field === 'swimAgreementInitials') {
    return null;
  }
  return props.clientErrors?.[props.field]?.message;
};

const visibleMessageKey = (props: {
  readonly clientMessage: unknown;
  readonly field: SailingCardOnboardingField;
  readonly state: SailingCardOnboardingFormState;
  readonly value:
    | NonNullable<
        SailingCardOnboardingFormState['fieldErrors']
      >[SailingCardOnboardingField]
    | undefined;
}) => {
  if (isOnboardingErrorMessageKey(props.clientMessage)) {
    return props.clientMessage;
  }
  if (props.state.status === 'error' && props.value !== undefined) {
    return fieldErrorMessageKey({ field: props.field, value: props.value });
  }
  return null;
};

export function FieldError(props: {
  readonly clientErrors?: FieldErrors<SailingCardOnboardingFormValues>;
  readonly field: SailingCardOnboardingField;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const value = props.state.fieldErrors[props.field];
  const clientMessage = clientErrorMessage({
    clientErrors: props.clientErrors,
    field: props.field,
  });
  const messageKey = visibleMessageKey({
    clientMessage,
    field: props.field,
    state: props.state,
    value,
  });

  if (messageKey === null) {
    return null;
  }

  return (
    <p
      className="text-sm font-medium text-destructive"
      id={fieldErrorId(props.field)}
      role="alert"
    >
      {t(messageKey)}
    </p>
  );
}
