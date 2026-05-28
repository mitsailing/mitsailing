'use client';

import { useTranslations } from 'next-intl';
import type * as React from 'react';
import type { UseFormRegister } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SailingAffiliation } from '@/generated/prisma/enums';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';
import { getSailingAffiliationOptions } from '@/libs/mit-sailing/sailingAffiliations';
import { sailingCardAgreement } from '@/libs/mit-sailing/sailingCardAgreementContent';
import type {
  SailingCardOnboardingFormState,
  SailingCardOnboardingFormValues,
} from '@/libs/mit-sailing/sailingCardOnboardingActions';
import { FieldError } from './SailingCardOnboardingFieldError';
import { fieldErrorId } from './SailingCardOnboardingFormHelpers';
import type { SailingCardOnboardingLockedIdentity } from './SailingCardOnboardingFormTypes';

const richLinkClassName =
  'font-medium text-mit-red underline underline-offset-2 hover:text-mit-red/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mit-red dark:text-mit-red-ink dark:hover:text-mit-red-ink/80';

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

const legalNoticeRichText = {
  privacy: renderPrivacyLink,
  terms: renderTermsLink,
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

export function AffiliationSelect(props: {
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

function ManualNameField(props: {
  readonly autoComplete: string;
  readonly field: 'firstName' | 'lastName';
  readonly label: string;
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly required: boolean;
  readonly state: SailingCardOnboardingFormState;
}) {
  const error = props.state.fieldErrors[props.field];

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-foreground" htmlFor={props.field}>
        {props.label}
      </Label>
      <Input
        aria-describedby={error ? fieldErrorId(props.field) : undefined}
        aria-invalid={error ? true : undefined}
        autoComplete={props.autoComplete}
        id={props.field}
        required={props.required}
        type="text"
        {...props.register(props.field, { required: props.required })}
      />
      <FieldError field={props.field} state={props.state} />
    </div>
  );
}

function ManualNameFields(props: {
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly required: boolean;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ManualNameField
        autoComplete="section-user given-name"
        field="firstName"
        label={t('first_name_label')}
        register={props.register}
        required={props.required}
        state={props.state}
      />
      <ManualNameField
        autoComplete="section-user family-name"
        field="lastName"
        label={t('last_name_label')}
        register={props.register}
        required={props.required}
        state={props.state}
      />
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
  readonly identity: SailingCardOnboardingLockedIdentity;
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

export function IdentityFields(props: {
  readonly identityComplete: boolean;
  readonly lockedIdentity?: SailingCardOnboardingLockedIdentity;
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

export function AgreementSection(props: {
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
