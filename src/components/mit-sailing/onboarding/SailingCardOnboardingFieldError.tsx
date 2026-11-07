'use client';

import { useTranslations } from 'next-intl';
import type { FieldErrors } from 'react-hook-form';
import { useFormState } from 'react-hook-form';
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

/**
 * Maps a server field-error code to an OnboardingPage message key.
 *
 * @param props - Field name and optional server error code
 * @returns Translation key for the visible field error
 */
const onboardingFieldErrorMessageKey = (props: {
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
  readonly fieldIsDirty: boolean;
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
    // After a server round-trip, editing the field hands display back to live
    // client validation so sticky server errors clear when the value is fixed.
    if (props.fieldIsDirty) {
      return null;
    }
    return onboardingFieldErrorMessageKey({
      field: props.field,
      value: props.value,
    });
  }
  return null;
};

/**
 * Whether a field should be marked aria-invalid for client and/or server errors.
 *
 * @param props - Client/server invalid flags and whether the field is dirty
 * @returns True when assistive tech should treat the control as invalid
 */
export const isOnboardingFieldInvalid = (props: {
  readonly clientInvalid: boolean;
  readonly fieldIsDirty: boolean;
  readonly serverInvalid: boolean;
}) => props.clientInvalid || (props.serverInvalid && !props.fieldIsDirty);

export function FieldError(props: {
  readonly clientErrors?: FieldErrors<SailingCardOnboardingFormValues>;
  readonly field: SailingCardOnboardingField;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const { dirtyFields } = useFormState({
    name: props.field,
  });
  const value = props.state.fieldErrors[props.field];
  const clientMessage = clientErrorMessage({
    clientErrors: props.clientErrors,
    field: props.field,
  });
  const fieldIsDirty = dirtyFields[props.field] === true;
  const messageKey = visibleMessageKey({
    clientMessage,
    field: props.field,
    fieldIsDirty,
    state: props.state,
    value,
  });

  if (messageKey === null) {
    return null;
  }

  return (
    <p
      className="text-sm font-medium text-red-900 motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in-0 motion-reduce:animate-none dark:text-red-100"
      id={fieldErrorId(props.field)}
      role="alert"
    >
      {t(messageKey)}
    </p>
  );
}
