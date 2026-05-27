import { useTranslations } from 'next-intl';
import type { SailingCardOnboardingFormState } from '@/libs/mit-sailing/sailingCardOnboardingActions';
import { fieldErrorId } from './SailingCardOnboardingFormHelpers';

type SailingCardOnboardingField =
  keyof SailingCardOnboardingFormState['fieldErrors'];

const fieldErrorMessageKey = (props: {
  readonly field: SailingCardOnboardingField;
  readonly value:
    | NonNullable<
        SailingCardOnboardingFormState['fieldErrors']
      >[SailingCardOnboardingField]
    | undefined;
}) => {
  if (props.value === 'required') {
    return 'error_required';
  }
  if (props.field === 'phone') {
    return 'error_invalid_phone';
  }
  if (props.field === 'emergencyContactPhone') {
    return 'error_invalid_emergency_phone';
  }
  if (props.field === 'emergencyContactEmail') {
    return 'error_invalid_email';
  }
  if (props.value === 'affiliation_mismatch') {
    return 'error_mit_id_affiliation_mismatch';
  }
  if (props.value === 'invalid_dw_identity') {
    return 'error_mit_id_invalid_dw_identity';
  }
  return 'error_mit_id_required_dw_identity';
};

export function FieldError(props: {
  readonly field: SailingCardOnboardingField;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const value = props.state.fieldErrors[props.field];
  if (props.state.status !== 'error' || value === undefined) {
    return null;
  }

  return (
    <p
      className="text-sm font-medium text-destructive"
      id={fieldErrorId(props.field)}
      role="alert"
    >
      {t(fieldErrorMessageKey({ field: props.field, value }))}
    </p>
  );
}
