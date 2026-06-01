import { useTranslations } from 'next-intl';
import type * as React from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  formatSailingCardDateOfBirthInput,
  normalizeSailingCardDateOfBirthInput,
  parseSailingCardDateOfBirth,
} from '@/libs/mit-sailing/sailingCardDateOfBirth';
import type {
  SailingCardOnboardingFormState,
  SailingCardOnboardingFormValues,
} from '@/libs/mit-sailing/sailingCardOnboardingActions';
import {
  formatPhoneAsYouType,
  normalizeInternationalPhone,
  normalizeUsPhone,
} from '@/utils/phoneValidation';
import { FieldError } from './SailingCardOnboardingFieldError';
import { fieldErrorId } from './SailingCardOnboardingFormHelpers';

function dateOfBirthDescribedBy(props: { readonly showError: boolean }) {
  return [
    'sailing-card-onboarding-dateOfBirth-help',
    props.showError ? fieldErrorId('dateOfBirth') : undefined,
  ]
    .filter((value) => value !== undefined)
    .join(' ');
}

const ariaDescribedBy = (ids: readonly (string | undefined)[]) =>
  ids.filter((id) => id !== undefined).join(' ');

const validateDateOfBirth = (value: string) =>
  value.trim() === '' ||
  parseSailingCardDateOfBirth({ allowIsoDate: true, value }) !== null ||
  'error_invalid_date_of_birth';

function DateOfBirthField(props: {
  readonly clientErrors: FieldErrors<SailingCardOnboardingFormValues>;
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const registration = props.register('dateOfBirth', {
    required: 'error_required',
    validate: validateDateOfBirth,
  });
  const dateOfBirthError = props.state.fieldErrors.dateOfBirth;
  const dateOfBirthClientError = props.clientErrors.dateOfBirth;
  const dateOfBirthHelpId = 'sailing-card-onboarding-dateOfBirth-help';
  const showError =
    dateOfBirthError !== undefined || dateOfBirthClientError !== undefined;
  const dateOfBirthAriaDescribedBy = dateOfBirthDescribedBy({
    showError,
  });
  const handleDateOfBirthBlur = async (
    event: React.FocusEvent<HTMLInputElement>
  ) => {
    event.currentTarget.value = normalizeSailingCardDateOfBirthInput({
      value: event.currentTarget.value,
    });
    await registration.onChange(event);
    await registration.onBlur(event);
  };
  const handleDateOfBirthChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    event.currentTarget.value = formatSailingCardDateOfBirthInput(
      event.currentTarget.value
    );
    await registration.onChange(event);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-foreground" htmlFor="dateOfBirth">
        {t('date_of_birth_label')}
      </Label>
      <Input
        aria-describedby={dateOfBirthAriaDescribedBy}
        aria-invalid={showError ? true : undefined}
        autoComplete="bday"
        id="dateOfBirth"
        inputMode="numeric"
        maxLength={10}
        name={registration.name}
        onBlur={handleDateOfBirthBlur}
        onChange={handleDateOfBirthChange}
        placeholder={t('date_of_birth_placeholder')}
        ref={registration.ref}
        required
        type="text"
      />
      <p className="text-xs text-muted-foreground" id={dateOfBirthHelpId}>
        {t('date_of_birth_help')}
      </p>
      <FieldError
        clientErrors={props.clientErrors}
        field="dateOfBirth"
        state={props.state}
      />
    </div>
  );
}

function PhoneField(props: {
  readonly clientErrors: FieldErrors<SailingCardOnboardingFormValues>;
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const phoneError = props.state.fieldErrors.phone;
  const phoneClientError = props.clientErrors.phone;
  const phoneHelpId = 'sailing-card-onboarding-phone-help';
  const showError = phoneError !== undefined || phoneClientError !== undefined;
  const registration = props.register('phone', {
    required: 'error_required',
    validate: (value) =>
      value.trim() === '' ||
      normalizeUsPhone(value).ok ||
      'error_invalid_phone',
  });
  const handlePhoneBlur = registration.onBlur;
  const handlePhoneChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    event.currentTarget.value = formatPhoneAsYouType(event.currentTarget.value);
    await registration.onChange(event);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-foreground" htmlFor="phone">
        {t('phone_label')}
      </Label>
      <Input
        aria-describedby={ariaDescribedBy([
          phoneHelpId,
          showError ? fieldErrorId('phone') : undefined,
        ])}
        aria-invalid={showError ? true : undefined}
        autoComplete="section-user tel"
        id="phone"
        inputMode="tel"
        name={registration.name}
        onBlur={handlePhoneBlur}
        onChange={handlePhoneChange}
        required
        ref={registration.ref}
        type="tel"
      />
      <p className="text-xs text-muted-foreground" id={phoneHelpId}>
        {t('phone_help')}
      </p>
      <FieldError
        clientErrors={props.clientErrors}
        field="phone"
        state={props.state}
      />
    </div>
  );
}

function EmergencyContactNameField(props: {
  readonly clientErrors: FieldErrors<SailingCardOnboardingFormValues>;
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const nameError = props.state.fieldErrors.emergencyContactName;
  const nameClientError = props.clientErrors.emergencyContactName;
  const showError = nameError !== undefined || nameClientError !== undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-foreground" htmlFor="emergencyContactName">
        {t('emergency_contact_name_label')}
      </Label>
      <Input
        aria-describedby={
          showError ? fieldErrorId('emergencyContactName') : undefined
        }
        aria-invalid={showError ? true : undefined}
        autoCapitalize="words"
        autoComplete="section-emergency name"
        id="emergencyContactName"
        required
        type="text"
        {...props.register('emergencyContactName', {
          required: 'error_required',
        })}
      />
      <FieldError
        clientErrors={props.clientErrors}
        field="emergencyContactName"
        state={props.state}
      />
    </div>
  );
}

function EmergencyContactPhoneField(props: {
  readonly clientErrors: FieldErrors<SailingCardOnboardingFormValues>;
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const phoneError = props.state.fieldErrors.emergencyContactPhone;
  const phoneClientError = props.clientErrors.emergencyContactPhone;
  const showError = phoneError !== undefined || phoneClientError !== undefined;
  const registration = props.register('emergencyContactPhone', {
    required: 'error_required',
    validate: (value) =>
      value.trim() === '' ||
      normalizeInternationalPhone(value).ok ||
      'error_invalid_emergency_phone',
  });
  const handlePhoneBlur = registration.onBlur;
  const handlePhoneChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    event.currentTarget.value = formatPhoneAsYouType(event.currentTarget.value);
    await registration.onChange(event);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-foreground" htmlFor="emergencyContactPhone">
        {t('emergency_contact_phone_label')}
      </Label>
      <Input
        aria-describedby={
          showError ? fieldErrorId('emergencyContactPhone') : undefined
        }
        aria-invalid={showError ? true : undefined}
        autoComplete="section-emergency tel"
        id="emergencyContactPhone"
        inputMode="tel"
        name={registration.name}
        onBlur={handlePhoneBlur}
        onChange={handlePhoneChange}
        required
        ref={registration.ref}
        type="tel"
      />
      <FieldError
        clientErrors={props.clientErrors}
        field="emergencyContactPhone"
        state={props.state}
      />
    </div>
  );
}

export function ContactAndSafetyFields(props: {
  readonly clientErrors: FieldErrors<SailingCardOnboardingFormValues>;
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <h2 className="text-base font-semibold text-foreground">
        {t('contact_and_safety_heading')}
      </h2>
      <div className="flex flex-col gap-3">
        <DateOfBirthField
          clientErrors={props.clientErrors}
          register={props.register}
          state={props.state}
        />
        <PhoneField
          clientErrors={props.clientErrors}
          register={props.register}
          state={props.state}
        />
        <EmergencyContactNameField
          clientErrors={props.clientErrors}
          register={props.register}
          state={props.state}
        />
        <EmergencyContactPhoneField
          clientErrors={props.clientErrors}
          register={props.register}
          state={props.state}
        />
      </div>
    </section>
  );
}
