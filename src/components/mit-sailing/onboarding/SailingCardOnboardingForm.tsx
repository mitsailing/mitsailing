'use client';

import { Sailboat } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState, useState, useTransition } from 'react';
import type * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SailingAffiliation, SailingCardType } from '@/generated/prisma/enums';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';
import { getSailingAffiliationOptions } from '@/libs/mit-sailing/sailingAffiliations';
import { sailingCardAgreement } from '@/libs/mit-sailing/sailingCardAgreementContent';
import {
  hasAutomaticFitnessMembership,
  needsFitnessMembershipQuestion,
  sailingCardMembershipPriceCents,
} from '@/libs/mit-sailing/sailingCardMembership';
import { submitSailingCardOnboardingAction } from '@/libs/mit-sailing/sailingCardOnboardingActions';
import type {
  SailingCardOnboardingFormState,
  SailingCardOnboardingFormValues,
} from '@/libs/mit-sailing/sailingCardOnboardingActions';
import {
  ContactFields,
  EmergencyContactFields,
} from './SailingCardOnboardingContactFields';
import { FieldError } from './SailingCardOnboardingFieldError';
import {
  fieldErrorId,
  formDataFromReactHookFormValues,
  getVisibleSailingAffiliation,
  getVisibleSailingAffiliationRule,
  isManualNameRequired,
  showManualNameForRule,
  showMitIdForRule,
} from './SailingCardOnboardingFormHelpers';

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
    emergencyContactName: '',
    emergencyContactPhone: '',
    firstName: '',
    hasFitnessMembership: '',
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

const usdFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

const cardTypeLabelKey = (cardType: SailingCardType) => {
  const keys = {
    [SailingCardType.normal]: 'card_type_normal',
    [SailingCardType.racing]: 'card_type_racing',
    [SailingCardType.team_racing]: 'card_type_team_racing',
  } as const satisfies Record<SailingCardType, string>;

  return keys[cardType];
};

const cardTypeDescriptionKey = (cardType: SailingCardType) => {
  const keys = {
    [SailingCardType.normal]: 'card_type_normal_description',
    [SailingCardType.racing]: 'card_type_racing_description',
    [SailingCardType.team_racing]: 'card_type_team_racing_description',
  } as const satisfies Record<SailingCardType, string>;

  return keys[cardType];
};

const formatMembershipPrice = (value: number | null) =>
  value === null ? null : usdFormatter.format(value / 100);

const radioCardClassName =
  'flex min-h-16 cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 text-sm transition-colors hover:border-mit-red/40 hover:bg-mit-red-highlight/40 has-checked:border-mit-red has-checked:bg-mit-red-highlight/60 has-aria-invalid:border-destructive has-aria-invalid:bg-destructive/5 has-disabled:cursor-not-allowed has-disabled:opacity-60';

const radioInputClassName = 'mt-0.5 size-4 shrink-0 accent-mit-red';

const richLinkClassName =
  'font-medium text-mit-red underline underline-offset-2 hover:text-mit-red/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mit-red';

const fitnessMembershipLinkClassName = `${richLinkClassName} dark:text-mit-red-ink`;

const renderFitnessMembershipLink = (chunks: React.ReactNode) => (
  <Link
    className={fitnessMembershipLinkClassName}
    href="https://www.mitrecsports.com/join/memberships/"
    key="membership"
  >
    {chunks}
  </Link>
);

const renderPrivacyLink = (chunks: React.ReactNode) => (
  <Link className={richLinkClassName} href="/privacy" key="privacy">
    {chunks}
  </Link>
);

const renderTermsLink = (chunks: React.ReactNode) => (
  <Link className={richLinkClassName} href="/terms" key="terms">
    {chunks}
  </Link>
);

const fitnessMembershipSignupNoteRichText = {
  membership: renderFitnessMembershipLink,
};

const legalNoticeRichText = {
  privacy: renderPrivacyLink,
  terms: renderTermsLink,
};

const membershipPriceLabelKey = (props: {
  readonly priceCents: number | null;
}) => {
  if (props.priceCents === 0) {
    return 'card_type_price_included';
  }
  if (props.priceCents === null) {
    return 'card_type_price_needs_dob';
  }
  return 'card_type_price';
};

const cardTypeDescription = (props: {
  readonly cardType: SailingCardType;
  readonly price: string | null;
  readonly t: ReturnType<typeof useTranslations<'OnboardingPage'>>;
}) => {
  if (props.cardType === SailingCardType.racing) {
    if (props.price === null) {
      return props.t('card_type_racing_description_needs_dob');
    }

    return props.t('card_type_racing_description', {
      price: props.price,
    });
  }

  return props.t(cardTypeDescriptionKey(props.cardType));
};

function FitnessMembershipQuestion(props: {
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly setValue: UseFormSetValue<SailingCardOnboardingFormValues>;
}) {
  const t = useTranslations('OnboardingPage');
  const helpId = 'sailing-card-onboarding-hasFitnessMembership-help';
  const signupNoteId = 'sailing-card-onboarding-fitness-signup-note';
  const registration = props.register('hasFitnessMembership', {
    required: true,
  });
  const handleFitnessMembershipBlur = registration.onBlur;

  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={`${helpId} ${signupNoteId}`}
    >
      <legend className="font-medium text-foreground">
        {t('fitness_membership_label')}
      </legend>
      <p className="text-xs leading-5 text-muted-foreground" id={helpId}>
        {t('fitness_membership_help')}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label
          aria-label={t('fitness_membership_yes')}
          className={radioCardClassName}
          htmlFor="hasFitnessMembershipYes"
        >
          <input
            className={radioInputClassName}
            id="hasFitnessMembershipYes"
            name={registration.name}
            onBlur={handleFitnessMembershipBlur}
            onChange={async (event) => {
              await registration.onChange(event);
              props.setValue('cardType', SailingCardType.normal);
            }}
            ref={registration.ref}
            required
            type="radio"
            value="yes"
          />
          <span className="flex min-w-0 flex-col gap-1 leading-normal">
            <span className="font-medium text-foreground">
              {t('fitness_membership_yes')}
            </span>
          </span>
        </label>
        <label
          aria-label={t('fitness_membership_no')}
          className={radioCardClassName}
          htmlFor="hasFitnessMembershipNo"
        >
          <input
            className={radioInputClassName}
            id="hasFitnessMembershipNo"
            name={registration.name}
            onBlur={handleFitnessMembershipBlur}
            onChange={async (event) => {
              await registration.onChange(event);
              props.setValue('cardType', SailingCardType.normal);
            }}
            ref={registration.ref}
            required
            type="radio"
            value="no"
          />
          <span className="flex min-w-0 flex-col gap-1 leading-normal">
            <span className="font-medium text-foreground">
              {t('fitness_membership_no')}
            </span>
          </span>
        </label>
      </div>
      <p className="text-xs leading-5 text-muted-foreground" id={signupNoteId}>
        {t.rich(
          'fitness_membership_signup_note',
          fitnessMembershipSignupNoteRichText
        )}
      </p>
    </fieldset>
  );
}

function CardTypeRadio(props: {
  readonly affiliation: SailingAffiliation | '';
  readonly cardType: SailingCardType;
  readonly cardTypeValue: string | undefined;
  readonly dateOfBirthValue: string | undefined;
  readonly now: Date;
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const priceCents = sailingCardMembershipPriceCents({
    affiliation: props.affiliation,
    cardType: props.cardType,
    dateOfBirth: props.dateOfBirthValue,
    now: props.now,
  });
  const price = formatMembershipPrice(priceCents);
  const priceLabelKey = membershipPriceLabelKey({
    priceCents,
  });
  const priceLabel =
    priceLabelKey === 'card_type_price' && price !== null
      ? t(priceLabelKey, { price })
      : t(priceLabelKey);
  const selectedCardType =
    props.cardTypeValue === ''
      ? SailingCardType.normal
      : (props.cardTypeValue ?? SailingCardType.normal);

  return (
    <label className={radioCardClassName}>
      <input
        {...props.register('cardType', { required: true })}
        className={radioInputClassName}
        defaultChecked={selectedCardType === props.cardType}
        required
        type="radio"
        value={props.cardType}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="font-medium text-foreground">
            {t(cardTypeLabelKey(props.cardType))}
          </span>
          <span
            className={cn(
              'rounded-md px-2 py-0.5 text-xs font-semibold',
              'bg-mit-red-highlight text-mit-red dark:text-mit-red-ink'
            )}
          >
            {priceLabel}
          </span>
        </span>
        <span className="text-xs leading-5 text-muted-foreground">
          {cardTypeDescription({
            cardType: props.cardType,
            price,
            t,
          })}
        </span>
      </span>
    </label>
  );
}

function CardTypeSelect(props: {
  readonly affiliation: SailingAffiliation | '';
  readonly cardTypeValue: string | undefined;
  readonly dateOfBirthValue: string | undefined;
  readonly fitnessMembershipReady: boolean;
  readonly now: Date;
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const cardTypeError = props.state.fieldErrors.cardType;

  return (
    <fieldset
      aria-describedby={cardTypeError ? fieldErrorId('cardType') : undefined}
      aria-invalid={cardTypeError ? true : undefined}
      className="flex flex-col gap-2"
    >
      <legend className="font-medium text-foreground">
        {t('card_type_label')}
      </legend>
      {props.fitnessMembershipReady ? (
        <div className="grid gap-2">
          <CardTypeRadio
            affiliation={props.affiliation}
            cardType={SailingCardType.normal}
            cardTypeValue={props.cardTypeValue}
            dateOfBirthValue={props.dateOfBirthValue}
            now={props.now}
            register={props.register}
            state={props.state}
          />
          <CardTypeRadio
            affiliation={props.affiliation}
            cardType={SailingCardType.racing}
            cardTypeValue={props.cardTypeValue}
            dateOfBirthValue={props.dateOfBirthValue}
            now={props.now}
            register={props.register}
            state={props.state}
          />
          <CardTypeRadio
            affiliation={props.affiliation}
            cardType={SailingCardType.team_racing}
            cardTypeValue={props.cardTypeValue}
            dateOfBirthValue={props.dateOfBirthValue}
            now={props.now}
            register={props.register}
            state={props.state}
          />
        </div>
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">
          {t('card_type_waiting_for_fitness')}
        </p>
      )}
      <FieldError field="cardType" state={props.state} />
    </fieldset>
  );
}

function AffiliationSelect(props: {
  readonly affiliation: SailingAffiliation | '';
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const affiliationError = props.state.fieldErrors.affiliation;
  const affiliationHelpId = 'sailing-card-onboarding-affiliation-help';

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-foreground" htmlFor="affiliation">
        {t('affiliation_label')}
      </Label>
      <select
        aria-describedby={
          affiliationError
            ? `${affiliationHelpId} ${fieldErrorId('affiliation')}`
            : affiliationHelpId
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
      <p className="text-xs text-muted-foreground" id={affiliationHelpId}>
        {t('affiliation_help')}
      </p>
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
  const mitIdHelpId = 'sailing-card-onboarding-mitId-help';
  const mitIdHelpKey = props.required
    ? 'mit_id_required_help'
    : 'mit_id_optional_help';

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-foreground" htmlFor="mitId">
        {t('mit_id_label')}
      </Label>
      <Input
        aria-describedby={
          mitIdError ? `${mitIdHelpId} ${fieldErrorId('mitId')}` : mitIdHelpId
        }
        aria-invalid={mitIdError ? true : undefined}
        autoComplete="off"
        id="mitId"
        inputMode="numeric"
        pattern="[0-9]*"
        required={props.required}
        type="text"
        {...props.register('mitId', { required: props.required })}
      />
      <p className="text-xs text-muted-foreground" id={mitIdHelpId}>
        {t(mitIdHelpKey)}
      </p>
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
          autoComplete="section-user given-name"
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
          autoComplete="section-user family-name"
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

function LegalNotice() {
  const t = useTranslations('OnboardingPage');

  return (
    <p className="text-xs leading-5 text-muted-foreground">
      {t.rich('agreement_legal_notice', legalNoticeRichText)}
    </p>
  );
}

function IdentityFields(props: {
  readonly identityComplete: boolean;
  readonly lockedIdentity?: SailingCardOnboardingFormProps['lockedIdentity'];
  readonly manualNameRequired: boolean;
  readonly mitIdRequired: boolean;
  readonly onContinue: () => void;
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly showContinue: boolean;
  readonly showLockedIdentity: boolean;
  readonly showManualName: boolean;
  readonly showMitId: boolean;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">
          {t('identity_heading')}
        </h2>
        <p className="text-xs leading-5 text-muted-foreground">
          {t('identity_help')}
        </p>
      </div>
      {props.showMitId ? (
        <MitIdField
          register={props.register}
          required={props.mitIdRequired}
          state={props.state}
        />
      ) : null}

      {props.showManualName ? (
        <ManualNameFields
          register={props.register}
          required={props.manualNameRequired}
          state={props.state}
        />
      ) : null}

      {props.showLockedIdentity && props.lockedIdentity ? (
        <LockedIdentityFields identity={props.lockedIdentity} />
      ) : null}
      {props.showContinue ? (
        <Button
          className="w-full sm:w-fit"
          disabled={!props.identityComplete}
          onClick={props.onContinue}
          type="button"
          variant="outline"
        >
          {t('continue')}
        </Button>
      ) : null}
    </section>
  );
}

const hasAnyError = (
  state: SailingCardOnboardingFormState,
  fields: readonly (keyof SailingCardOnboardingFormState['fieldErrors'])[]
) => fields.some((field) => state.fieldErrors[field] !== undefined);

const isCompleteMitId = (value: string | undefined) =>
  /^\d{9}$/.test((value ?? '').replaceAll(/\D/g, ''));

const hasCompleteManualName = (props: {
  readonly firstNameValue: string | undefined;
  readonly lastNameValue: string | undefined;
}) =>
  (props.firstNameValue ?? '').trim() !== '' &&
  (props.lastNameValue ?? '').trim() !== '';

const hasLockedIdentity = (props: {
  readonly lockedIdentity?: SailingCardOnboardingFormProps['lockedIdentity'];
  readonly showLockedIdentity: boolean;
}) => props.showLockedIdentity && props.lockedIdentity !== undefined;

const hasUsableMitId = (props: {
  readonly mitIdValue: string | undefined;
  readonly showMitId: boolean;
}) => props.showMitId && isCompleteMitId(props.mitIdValue);

const canUseManualName = (props: {
  readonly mitIdValue: string | undefined;
  readonly rule: ReturnType<typeof getVisibleSailingAffiliationRule>;
  readonly showManualName: boolean;
}) =>
  props.rule?.mitIdMode !== 'required' &&
  props.showManualName &&
  (props.mitIdValue ?? '').trim() === '';

const isIdentityComplete = (props: {
  readonly firstNameValue: string | undefined;
  readonly lastNameValue: string | undefined;
  readonly lockedIdentity?: SailingCardOnboardingFormProps['lockedIdentity'];
  readonly mitIdValue: string | undefined;
  readonly rule: ReturnType<typeof getVisibleSailingAffiliationRule>;
  readonly showLockedIdentity: boolean;
  readonly showManualName: boolean;
  readonly showMitId: boolean;
}) => {
  if (props.rule === null) {
    return false;
  }
  if (
    hasLockedIdentity({
      lockedIdentity: props.lockedIdentity,
      showLockedIdentity: props.showLockedIdentity,
    })
  ) {
    return true;
  }
  if (
    hasUsableMitId({
      mitIdValue: props.mitIdValue,
      showMitId: props.showMitId,
    })
  ) {
    return true;
  }
  if (
    !canUseManualName({
      mitIdValue: props.mitIdValue,
      rule: props.rule,
      showManualName: props.showManualName,
    })
  ) {
    return false;
  }
  return hasCompleteManualName({
    firstNameValue: props.firstNameValue,
    lastNameValue: props.lastNameValue,
  });
};

const shouldShowDetails = (props: {
  readonly detailsUnlocked: boolean;
  readonly identityComplete: boolean;
  readonly state: SailingCardOnboardingFormState;
}) => {
  if (
    hasAnyError(props.state, [
      'cardType',
      'dateOfBirth',
      'emergencyContactName',
      'emergencyContactPhone',
      'phone',
      'swimAgreementAccepted',
    ])
  ) {
    return true;
  }
  return props.detailsUnlocked && props.identityComplete;
};

const isFitnessMembershipReady = (props: {
  readonly affiliation: SailingAffiliation | '';
  readonly hasFitnessMembershipValue: string | undefined;
}) =>
  hasAutomaticFitnessMembership(props.affiliation) ||
  props.hasFitnessMembershipValue === 'yes' ||
  props.hasFitnessMembershipValue === 'no';

const getIdentityVisibility = (props: {
  readonly lockedIdentity?: SailingCardOnboardingFormProps['lockedIdentity'];
  readonly rule: ReturnType<typeof getVisibleSailingAffiliationRule>;
}) => {
  const showMitId = showMitIdForRule(props.rule);
  const showLockedIdentity = showMitId && props.lockedIdentity !== undefined;
  const showManualName = showManualNameForRule({
    lockedIdentity: showLockedIdentity,
    rule: props.rule,
  });

  return {
    showLockedIdentity,
    showManualName,
    showMitId,
  };
};

function CardRequestSection(props: {
  readonly affiliation: SailingAffiliation | '';
  readonly cardTypeValue: string | undefined;
  readonly dateOfBirthValue: string | undefined;
  readonly fitnessMembershipReady: boolean;
  readonly now: Date;
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly setValue: UseFormSetValue<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <h2 className="text-base font-semibold text-foreground">
        {t('card_request_heading')}
      </h2>
      {needsFitnessMembershipQuestion(props.affiliation) ? (
        <FitnessMembershipQuestion
          register={props.register}
          setValue={props.setValue}
        />
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">
          {t('fitness_membership_auto_mit_student')}
        </p>
      )}
      <CardTypeSelect
        affiliation={props.affiliation}
        cardTypeValue={props.cardTypeValue}
        dateOfBirthValue={props.dateOfBirthValue}
        fitnessMembershipReady={props.fitnessMembershipReady}
        now={props.now}
        register={props.register}
        state={props.state}
      />
    </section>
  );
}

function AgreementSection(props: {
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <h2 className="text-base font-semibold text-foreground">
        {t('agreement_heading')}
      </h2>
      <AgreementDisclosure />
      <AgreementCheckbox register={props.register} state={props.state} />
      <LegalNotice />
    </section>
  );
}

function SubmitButton(props: { readonly isPending: boolean }) {
  const t = useTranslations('OnboardingPage');

  return (
    <Button
      className="w-full gap-2 sm:w-fit"
      disabled={props.isPending}
      type="submit"
      variant="mit"
    >
      <Sailboat aria-hidden className="size-4" />
      {t('submit')}
    </Button>
  );
}

function OnboardingDetailsFields(props: {
  readonly affiliation: SailingAffiliation | '';
  readonly cardTypeValue: string | undefined;
  readonly dateOfBirthValue: string | undefined;
  readonly fitnessMembershipReady: boolean;
  readonly isPending: boolean;
  readonly now: Date;
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly setValue: UseFormSetValue<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  return (
    <>
      <ContactFields register={props.register} state={props.state} />
      <EmergencyContactFields register={props.register} state={props.state} />
      <CardRequestSection
        affiliation={props.affiliation}
        cardTypeValue={props.cardTypeValue}
        dateOfBirthValue={props.dateOfBirthValue}
        fitnessMembershipReady={props.fitnessMembershipReady}
        now={props.now}
        register={props.register}
        setValue={props.setValue}
        state={props.state}
      />
      <AgreementSection register={props.register} state={props.state} />
      <SubmitButton isPending={props.isPending} />
    </>
  );
}

function OnboardingFormFields(props: {
  readonly affiliation: SailingAffiliation | '';
  readonly cardTypeValue: string | undefined;
  readonly dateOfBirthValue: string | undefined;
  readonly fitnessMembershipReady: boolean;
  readonly identityComplete: boolean;
  readonly isPending: boolean;
  readonly lockedIdentity?: SailingCardOnboardingFormProps['lockedIdentity'];
  readonly manualNameRequired: boolean;
  readonly mitIdRequired: boolean;
  readonly now: Date;
  readonly onContinueIdentity: () => void;
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly setValue: UseFormSetValue<SailingCardOnboardingFormValues>;
  readonly showDetails: boolean;
  readonly showLockedIdentity: boolean;
  readonly showManualName: boolean;
  readonly showMitId: boolean;
  readonly state: SailingCardOnboardingFormState;
}) {
  return (
    <>
      <AffiliationSelect
        affiliation={props.affiliation}
        register={props.register}
        state={props.state}
      />
      {props.affiliation === '' ? null : (
        <IdentityFields
          identityComplete={props.identityComplete}
          lockedIdentity={props.lockedIdentity}
          manualNameRequired={props.manualNameRequired}
          mitIdRequired={props.mitIdRequired}
          onContinue={props.onContinueIdentity}
          register={props.register}
          showContinue={!props.showDetails}
          showLockedIdentity={props.showLockedIdentity}
          showManualName={props.showManualName}
          showMitId={props.showMitId}
          state={props.state}
        />
      )}
      {props.showDetails ? (
        <OnboardingDetailsFields
          affiliation={props.affiliation}
          cardTypeValue={props.cardTypeValue}
          dateOfBirthValue={props.dateOfBirthValue}
          fitnessMembershipReady={props.fitnessMembershipReady}
          isPending={props.isPending}
          now={props.now}
          register={props.register}
          setValue={props.setValue}
          state={props.state}
        />
      ) : null}
    </>
  );
}

export function SailingCardOnboardingForm(
  props: SailingCardOnboardingFormProps
) {
  const [state, formAction] = useActionState(
    props.action ?? defaultSailingCardOnboardingAction,
    initialSailingCardOnboardingFormState
  );
  const [detailsUnlocked, setDetailsUnlocked] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formValues =
    state.status === 'idle' && props.initialValues !== undefined
      ? props.initialValues
      : state.values;
  const form = useForm<SailingCardOnboardingFormValues>({
    values: formValues,
  });
  const [now] = useState(() => new Date());
  const [
    affiliationValue,
    mitIdValue,
    firstNameValue,
    lastNameValue,
    dateOfBirthValue,
    hasFitnessMembershipValue,
    cardTypeValue,
  ] = useWatch({
    control: form.control,
    name: [
      'affiliation',
      'mitId',
      'firstName',
      'lastName',
      'dateOfBirth',
      'hasFitnessMembership',
      'cardType',
    ],
  });
  const affiliation = getVisibleSailingAffiliation(affiliationValue);
  const fitnessMembershipReady = isFitnessMembershipReady({
    affiliation,
    hasFitnessMembershipValue,
  });
  const rule = getVisibleSailingAffiliationRule(affiliation);
  const identityVisibility = getIdentityVisibility({
    lockedIdentity: props.lockedIdentity,
    rule,
  });
  const manualNameRequired = isManualNameRequired({
    mitIdValue,
    rule,
    showManualName: identityVisibility.showManualName,
  });
  const identityComplete = isIdentityComplete({
    firstNameValue,
    lastNameValue,
    lockedIdentity: props.lockedIdentity,
    mitIdValue,
    rule,
    showLockedIdentity: identityVisibility.showLockedIdentity,
    showManualName: identityVisibility.showManualName,
    showMitId: identityVisibility.showMitId,
  });
  const showDetails = shouldShowDetails({
    detailsUnlocked,
    identityComplete,
    state,
  });

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
      <OnboardingFormFields
        affiliation={affiliation}
        cardTypeValue={cardTypeValue}
        dateOfBirthValue={dateOfBirthValue}
        fitnessMembershipReady={fitnessMembershipReady}
        identityComplete={identityComplete}
        isPending={isPending}
        lockedIdentity={props.lockedIdentity}
        manualNameRequired={manualNameRequired}
        mitIdRequired={rule?.mitIdMode === 'required'}
        now={now}
        onContinueIdentity={() => {
          setDetailsUnlocked(true);
        }}
        register={form.register}
        setValue={form.setValue}
        showDetails={showDetails}
        showLockedIdentity={identityVisibility.showLockedIdentity}
        showManualName={identityVisibility.showManualName}
        showMitId={identityVisibility.showMitId}
        state={state}
      />
    </form>
  );
}
