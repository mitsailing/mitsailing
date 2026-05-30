import { useTranslations } from 'next-intl';
import type * as React from 'react';
import { useState } from 'react';
import type { UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  formatSailingCardDateOfBirthInput,
  parseSailingCardDateOfBirth,
} from '@/libs/mit-sailing/sailingCardDateOfBirth';
import type {
  SailingCardOnboardingFormState,
  SailingCardOnboardingFormValues,
} from '@/libs/mit-sailing/sailingCardOnboardingActions';
import { formatPhoneAsYouType } from '@/utils/phoneValidation';
import { FieldError } from './SailingCardOnboardingFieldError';
import { fieldErrorId } from './SailingCardOnboardingFormHelpers';

function dateOfBirthDescribedBy(props: {
  readonly dateOfBirthError: string | undefined;
  readonly showClientError: boolean;
}) {
  return [
    'sailing-card-onboarding-dateOfBirth-help',
    props.dateOfBirthError ? fieldErrorId('dateOfBirth') : undefined,
    props.showClientError
      ? 'sailing-card-onboarding-dateOfBirth-client-error'
      : undefined,
  ]
    .filter((value) => value !== undefined)
    .join(' ');
}

function DateOfBirthClientError(props: { readonly visible: boolean }) {
  const t = useTranslations('OnboardingPage');

  if (!props.visible) {
    return null;
  }

  return (
    <p
      className="text-sm font-medium text-destructive"
      id="sailing-card-onboarding-dateOfBirth-client-error"
      role="alert"
    >
      {t('error_invalid_date_of_birth')}
    </p>
  );
}

function DateOfBirthField(props: {
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const [clientError, setClientError] = useState(false);
  const registration = props.register('dateOfBirth', {
    required: true,
  });
  const dateOfBirthError = props.state.fieldErrors.dateOfBirth;
  const dateOfBirthHelpId = 'sailing-card-onboarding-dateOfBirth-help';
  const showClientError = dateOfBirthError === undefined && clientError;
  const describedBy = dateOfBirthDescribedBy({
    dateOfBirthError,
    showClientError,
  });
  const updateDateOfBirthClientError = (value: string) => {
    setClientError(
      value.trim() !== '' && parseSailingCardDateOfBirth({ value }) === null
    );
  };
  const handleDateOfBirthChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    event.currentTarget.value = formatSailingCardDateOfBirthInput(
      event.currentTarget.value
    );
    if (clientError) {
      updateDateOfBirthClientError(event.currentTarget.value);
    }
    await registration.onChange(event);
  };
  const handleDateOfBirthBlur = async (
    event: React.FocusEvent<HTMLInputElement>
  ) => {
    updateDateOfBirthClientError(event.currentTarget.value);
    await registration.onBlur(event);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-foreground" htmlFor="dateOfBirth">
        {t('date_of_birth_label')}
      </Label>
      <Input
        aria-describedby={describedBy}
        aria-invalid={dateOfBirthError || showClientError ? true : undefined}
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
      <FieldError field="dateOfBirth" state={props.state} />
      <DateOfBirthClientError visible={showClientError} />
    </div>
  );
}

function PhoneField(props: {
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const phoneError = props.state.fieldErrors.phone;
  const phoneHelpId = 'sailing-card-onboarding-phone-help';
  const registration = props.register('phone', { required: true });
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
        aria-describedby={
          phoneError ? `${phoneHelpId} ${fieldErrorId('phone')}` : phoneHelpId
        }
        aria-invalid={phoneError ? true : undefined}
        autoComplete="section-user tel"
        id="phone"
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
      <FieldError field="phone" state={props.state} />
    </div>
  );
}

function EmergencyContactNameField(props: {
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const nameError = props.state.fieldErrors.emergencyContactName;

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-foreground" htmlFor="emergencyContactName">
        {t('emergency_contact_name_label')}
      </Label>
      <Input
        aria-describedby={
          nameError ? fieldErrorId('emergencyContactName') : undefined
        }
        aria-invalid={nameError ? true : undefined}
        autoComplete="section-emergency name"
        id="emergencyContactName"
        required
        type="text"
        {...props.register('emergencyContactName', { required: true })}
      />
      <FieldError field="emergencyContactName" state={props.state} />
    </div>
  );
}

function EmergencyContactPhoneField(props: {
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const phoneError = props.state.fieldErrors.emergencyContactPhone;
  const registration = props.register('emergencyContactPhone', {
    required: true,
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
          phoneError ? fieldErrorId('emergencyContactPhone') : undefined
        }
        aria-invalid={phoneError ? true : undefined}
        autoComplete="section-emergency tel"
        id="emergencyContactPhone"
        name={registration.name}
        onBlur={handlePhoneBlur}
        onChange={handlePhoneChange}
        required
        ref={registration.ref}
        type="tel"
      />
      <FieldError field="emergencyContactPhone" state={props.state} />
    </div>
  );
}

export function ContactAndSafetyFields(props: {
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <h2 className="text-base font-semibold text-foreground">
        {t('contact_and_safety_heading')}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <DateOfBirthField register={props.register} state={props.state} />
        <PhoneField register={props.register} state={props.state} />
        <EmergencyContactNameField
          register={props.register}
          state={props.state}
        />
        <EmergencyContactPhoneField
          register={props.register}
          state={props.state}
        />
      </div>
    </section>
  );
}
