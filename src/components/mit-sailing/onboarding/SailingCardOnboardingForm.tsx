'use client';

import { Sailboat } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { UseFormRegister } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SailingAffiliation } from '@/generated/prisma/enums';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import {
  getSailingAffiliationOptions,
  getSailingAffiliationRule,
} from '@/libs/mit-sailing/sailingAffiliations';
import { sailingCardAgreement } from '@/libs/mit-sailing/sailingCardAgreementContent';
import { submitSailingCardOnboardingAction } from '@/libs/mit-sailing/sailingCardOnboardingActions';
import type {
  SailingCardOnboardingFormState,
  SailingCardOnboardingFormValues,
} from '@/libs/mit-sailing/sailingCardOnboardingActions';

export const defaultSailingCardOnboardingAction =
  submitSailingCardOnboardingAction;

type SailingCardOnboardingFormProps = {
  readonly action?: (
    previousState: SailingCardOnboardingFormState,
    formData: FormData
  ) => Promise<SailingCardOnboardingFormState>;
  readonly callbackUrl?: string;
  readonly initialValues?: SailingCardOnboardingFormValues;
  readonly lockedIdentity?: {
    readonly firstName: string;
    readonly lastName: string;
    readonly mitClassYear: string | null;
  };
};

const initialSailingCardOnboardingFormState: SailingCardOnboardingFormState = {
  fieldErrors: {},
  status: 'idle',
  values: {
    affiliation: '',
    cardType: 'normal',
    dateOfBirth: '',
    emergencyContactEmail: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    firstName: '',
    lastName: '',
    mitId: '',
    phone: '',
    swimAgreementAccepted: false,
  },
};

const affiliationLabelKey = (affiliation: SailingAffiliation) => {
  const keys = {
    [SailingAffiliation.MIT_STUDENT]: 'affiliation_mit_student',
    [SailingAffiliation.MIT_FACULTY]: 'affiliation_mit_faculty',
    [SailingAffiliation.MIT_STAFF]: 'affiliation_mit_staff',
    [SailingAffiliation.MIT_ALUM]: 'affiliation_mit_alum',
    [SailingAffiliation.MIT_FAMILY]: 'affiliation_mit_family',
    [SailingAffiliation.MIT_AFFILIATE]: 'affiliation_mit_affiliate',
    [SailingAffiliation.WELLESLEY]: 'affiliation_wellesley',
    [SailingAffiliation.BRANDEIS]: 'affiliation_brandeis',
    [SailingAffiliation.NORTHEASTERN]: 'affiliation_northeastern',
    [SailingAffiliation.WINSOR]: 'affiliation_winsor',
    [SailingAffiliation.BROOKS]: 'affiliation_brooks',
    [SailingAffiliation.NROTC]: 'affiliation_nrotc',
    [SailingAffiliation.OTHER_STUDENT]: 'affiliation_other_student',
    [SailingAffiliation.OTHER_NON_STUDENT]: 'affiliation_other_non_student',
    [SailingAffiliation.NON_MIT]: 'affiliation_non_mit',
  } as const satisfies Record<SailingAffiliation, string>;

  return keys[affiliation];
};

const fieldErrorMessageKey = (props: {
  readonly field: keyof SailingCardOnboardingFormState['fieldErrors'];
  readonly value:
    | NonNullable<
        SailingCardOnboardingFormState['fieldErrors']
      >[keyof SailingCardOnboardingFormState['fieldErrors']]
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

const fieldErrorId = (
  field: keyof SailingCardOnboardingFormState['fieldErrors']
) => `sailing-card-onboarding-${field}-error`;

const isVisibleSailingAffiliation = (
  value: string
): value is SailingAffiliation =>
  getSailingAffiliationOptions().some((option) => option.value === value);

const formDataFromReactHookFormValues = (props: {
  readonly callbackUrl?: string;
  readonly values: SailingCardOnboardingFormValues;
}) => {
  const formData = new FormData();
  const rule = isVisibleSailingAffiliation(props.values.affiliation)
    ? getSailingAffiliationRule(props.values.affiliation)
    : null;
  const showMitId =
    rule?.mitIdMode === 'required' || rule?.mitIdMode === 'optional';
  const showManualName = rule?.allowManualName === true;

  formData.set('affiliation', props.values.affiliation);
  formData.set('cardType', props.values.cardType);
  formData.set('dateOfBirth', props.values.dateOfBirth);
  formData.set('emergencyContactEmail', props.values.emergencyContactEmail);
  formData.set('emergencyContactName', props.values.emergencyContactName);
  formData.set('emergencyContactPhone', props.values.emergencyContactPhone);
  formData.set('firstName', showManualName ? props.values.firstName : '');
  formData.set('lastName', showManualName ? props.values.lastName : '');
  formData.set('mitId', showMitId ? props.values.mitId : '');
  formData.set('phone', props.values.phone);
  if (props.callbackUrl) {
    formData.set('callbackUrl', props.callbackUrl);
  }
  if (props.values.swimAgreementAccepted) {
    formData.set('swimAgreementAccepted', 'on');
  }

  return formData;
};

function FieldError(props: {
  readonly field: keyof SailingCardOnboardingFormState['fieldErrors'];
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

function CardTypeSelect(props: {
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const cardTypeError = props.state.fieldErrors.cardType;

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-foreground" htmlFor="cardType">
        {t('card_type_label')}
      </Label>
      <select
        aria-describedby={cardTypeError ? fieldErrorId('cardType') : undefined}
        aria-invalid={cardTypeError ? true : undefined}
        className={adminNativeSelectClassName}
        id="cardType"
        required
        {...props.register('cardType', { required: true })}
      >
        <option value="normal">{t('card_type_normal')}</option>
        <option value="racing">{t('card_type_racing')}</option>
        <option value="team_racing">{t('card_type_team_racing')}</option>
      </select>
      <FieldError field="cardType" state={props.state} />
    </div>
  );
}

function ContactFields(props: {
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const dateOfBirthError = props.state.fieldErrors.dateOfBirth;
  const phoneError = props.state.fieldErrors.phone;

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <h2 className="text-base font-semibold text-foreground">
        {t('contact_details_heading')}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" htmlFor="dateOfBirth">
            {t('date_of_birth_label')}
          </Label>
          <Input
            aria-describedby={
              dateOfBirthError ? fieldErrorId('dateOfBirth') : undefined
            }
            aria-invalid={dateOfBirthError ? true : undefined}
            id="dateOfBirth"
            required
            type="date"
            {...props.register('dateOfBirth', { required: true })}
          />
          <FieldError field="dateOfBirth" state={props.state} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" htmlFor="phone">
            {t('phone_label')}
          </Label>
          <Input
            aria-describedby={phoneError ? fieldErrorId('phone') : undefined}
            aria-invalid={phoneError ? true : undefined}
            autoComplete="tel"
            id="phone"
            required
            type="tel"
            {...props.register('phone', { required: true })}
          />
          <FieldError field="phone" state={props.state} />
        </div>
      </div>
    </section>
  );
}

function EmergencyContactFields(props: {
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const emergencyContactNameError =
    props.state.fieldErrors.emergencyContactName;
  const emergencyContactPhoneError =
    props.state.fieldErrors.emergencyContactPhone;
  const emergencyContactEmailError =
    props.state.fieldErrors.emergencyContactEmail;

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <h2 className="text-base font-semibold text-foreground">
        {t('emergency_contact_heading')}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" htmlFor="emergencyContactName">
            {t('emergency_contact_name_label')}
          </Label>
          <Input
            aria-describedby={
              emergencyContactNameError
                ? fieldErrorId('emergencyContactName')
                : undefined
            }
            aria-invalid={emergencyContactNameError ? true : undefined}
            autoComplete="name"
            id="emergencyContactName"
            required
            type="text"
            {...props.register('emergencyContactName', { required: true })}
          />
          <FieldError field="emergencyContactName" state={props.state} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" htmlFor="emergencyContactPhone">
            {t('emergency_contact_phone_label')}
          </Label>
          <Input
            aria-describedby={
              emergencyContactPhoneError
                ? fieldErrorId('emergencyContactPhone')
                : undefined
            }
            aria-invalid={emergencyContactPhoneError ? true : undefined}
            autoComplete="tel"
            id="emergencyContactPhone"
            required
            type="tel"
            {...props.register('emergencyContactPhone', { required: true })}
          />
          <FieldError field="emergencyContactPhone" state={props.state} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-foreground" htmlFor="emergencyContactEmail">
          {t('emergency_contact_email_label')}
        </Label>
        <Input
          aria-describedby={
            emergencyContactEmailError
              ? fieldErrorId('emergencyContactEmail')
              : undefined
          }
          aria-invalid={emergencyContactEmailError ? true : undefined}
          autoComplete="email"
          id="emergencyContactEmail"
          type="email"
          {...props.register('emergencyContactEmail')}
        />
        <FieldError field="emergencyContactEmail" state={props.state} />
      </div>
    </section>
  );
}

function AffiliationSelect(props: {
  readonly affiliation: SailingAffiliation | '';
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const affiliationError = props.state.fieldErrors.affiliation;

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-foreground" htmlFor="affiliation">
        {t('affiliation_label')}
      </Label>
      <select
        aria-describedby={
          affiliationError ? fieldErrorId('affiliation') : undefined
        }
        aria-invalid={affiliationError ? true : undefined}
        className={adminNativeSelectClassName}
        id="affiliation"
        required
        value={props.affiliation}
        {...props.register('affiliation', { required: true })}
      >
        <option value="">{t('affiliation_placeholder')}</option>
        {getSailingAffiliationOptions().map((option) => (
          <option key={option.value} value={option.value}>
            {t(affiliationLabelKey(option.value))}
          </option>
        ))}
      </select>
      <FieldError field="affiliation" state={props.state} />
    </div>
  );
}

function MitIdField(props: {
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly required: boolean;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const mitIdError = props.state.fieldErrors.mitId;

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-foreground" htmlFor="mitId">
        {t('mit_id_label')}
      </Label>
      <Input
        aria-describedby={mitIdError ? fieldErrorId('mitId') : undefined}
        aria-invalid={mitIdError ? true : undefined}
        autoComplete="off"
        id="mitId"
        inputMode="numeric"
        required={props.required}
        type="text"
        {...props.register('mitId', { required: props.required })}
      />
      <FieldError field="mitId" state={props.state} />
    </div>
  );
}

function ManualNameFields(props: {
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly required: boolean;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const firstNameError = props.state.fieldErrors.firstName;
  const lastNameError = props.state.fieldErrors.lastName;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label className="text-foreground" htmlFor="firstName">
          {t('first_name_label')}
        </Label>
        <Input
          aria-describedby={
            firstNameError ? fieldErrorId('firstName') : undefined
          }
          aria-invalid={firstNameError ? true : undefined}
          autoComplete="given-name"
          id="firstName"
          required={props.required}
          type="text"
          {...props.register('firstName', { required: props.required })}
        />
        <FieldError field="firstName" state={props.state} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-foreground" htmlFor="lastName">
          {t('last_name_label')}
        </Label>
        <Input
          aria-describedby={
            lastNameError ? fieldErrorId('lastName') : undefined
          }
          aria-invalid={lastNameError ? true : undefined}
          autoComplete="family-name"
          id="lastName"
          required={props.required}
          type="text"
          {...props.register('lastName', { required: props.required })}
        />
        <FieldError field="lastName" state={props.state} />
      </div>
    </div>
  );
}

function ReadOnlyIdentityField(props: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}) {
  const t = useTranslations('OnboardingPage');

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-foreground" htmlFor={props.id}>
        {props.label}
      </Label>
      <Input id={props.id} readOnly type="text" value={props.value} />
      <p className="text-xs text-muted-foreground">{t('locked_name_help')}</p>
    </div>
  );
}

function LockedIdentityFields(props: {
  readonly identity: NonNullable<
    SailingCardOnboardingFormProps['lockedIdentity']
  >;
}) {
  const t = useTranslations('OnboardingPage');

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ReadOnlyIdentityField
        id="firstName"
        label={t('first_name_label')}
        value={props.identity.firstName}
      />
      <ReadOnlyIdentityField
        id="lastName"
        label={t('last_name_label')}
        value={props.identity.lastName}
      />
      {props.identity.mitClassYear ? (
        <ReadOnlyIdentityField
          id="mitClassYear"
          label={t('mit_class_year_label')}
          value={props.identity.mitClassYear}
        />
      ) : null}
    </div>
  );
}

function AgreementDisclosure() {
  const t = useTranslations('OnboardingPage');

  return (
    <details className="rounded border border-border bg-muted/30 px-3 py-2">
      <summary className="cursor-pointer font-medium text-foreground">
        {t('agreement_disclosure_summary')}
      </summary>
      <div className="mt-2 flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
        {sailingCardAgreement.text.split('\n\n').map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </details>
  );
}

function AgreementCheckbox(props: {
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const agreementError = props.state.fieldErrors.swimAgreementAccepted;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="flex items-start gap-2 text-sm font-medium text-foreground"
        htmlFor="swimAgreementAccepted"
      >
        <input
          aria-describedby={
            agreementError ? fieldErrorId('swimAgreementAccepted') : undefined
          }
          aria-invalid={agreementError ? true : undefined}
          className="mt-1 size-4 shrink-0 rounded border-input text-mit-red"
          id="swimAgreementAccepted"
          required
          type="checkbox"
          {...props.register('swimAgreementAccepted', { required: true })}
        />
        <span>{t('agreement_checkbox_label')}</span>
      </label>
      <FieldError field="swimAgreementAccepted" state={props.state} />
    </div>
  );
}

export function SailingCardOnboardingForm(
  props: SailingCardOnboardingFormProps
) {
  const t = useTranslations('OnboardingPage');
  const [state, formAction] = useActionState(
    props.action ?? defaultSailingCardOnboardingAction,
    initialSailingCardOnboardingFormState
  );
  const [isPending, startTransition] = useTransition();
  const formValues =
    state.status === 'idle' && props.initialValues !== undefined
      ? props.initialValues
      : state.values;
  const form = useForm<SailingCardOnboardingFormValues>({
    values: formValues,
  });
  const affiliationValue = useWatch({
    control: form.control,
    name: 'affiliation',
  });
  const mitIdValue = useWatch({
    control: form.control,
    name: 'mitId',
  });
  const affiliation = isVisibleSailingAffiliation(affiliationValue)
    ? affiliationValue
    : '';
  const rule =
    affiliation === '' ? null : getSailingAffiliationRule(affiliation);
  const showMitId = rule !== null && rule.mitIdMode !== 'hidden';
  const showLockedIdentity = showMitId && props.lockedIdentity !== undefined;
  const showManualName =
    rule !== null && rule.allowManualName && !showLockedIdentity;
  const manualNameRequired =
    rule !== null &&
    showManualName &&
    !(rule.mitIdMode === 'optional' && (mitIdValue ?? '').trim() !== '');

  return (
    <form
      className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded border border-border bg-background p-4 text-sm shadow-sm"
      onSubmit={form.handleSubmit((values) => {
        startTransition(() => {
          formAction(
            formDataFromReactHookFormValues({
              callbackUrl: props.callbackUrl,
              values,
            })
          );
        });
      })}
    >
      <AffiliationSelect
        affiliation={affiliation}
        register={form.register}
        state={state}
      />

      {showMitId ? (
        <MitIdField
          register={form.register}
          required={rule?.mitIdMode === 'required'}
          state={state}
        />
      ) : null}

      {showManualName ? (
        <ManualNameFields
          register={form.register}
          required={manualNameRequired}
          state={state}
        />
      ) : null}

      {showLockedIdentity ? (
        <LockedIdentityFields identity={props.lockedIdentity} />
      ) : null}

      <CardTypeSelect register={form.register} state={state} />
      <ContactFields register={form.register} state={state} />
      <EmergencyContactFields register={form.register} state={state} />
      <AgreementDisclosure />
      <AgreementCheckbox register={form.register} state={state} />

      <Button
        className="w-full gap-2 sm:w-fit"
        disabled={isPending}
        type="submit"
        variant="mit"
      >
        <Sailboat aria-hidden className="size-4" />
        {t('submit')}
      </Button>
    </form>
  );
}
