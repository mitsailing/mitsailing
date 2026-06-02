'use client';

import { Sailboat } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from 'react-hook-form';
import { Button } from '@/components/ui/button';
import type { SailingAffiliation } from '@/generated/prisma/enums';
import type {
  SailingCardOnboardingFormState,
  SailingCardOnboardingFormValues,
} from '@/libs/mit-sailing/sailingCardOnboardingActions';
import { CardRequestSection } from './SailingCardOnboardingCardRequestFields';
import { ContactAndSafetyFields } from './SailingCardOnboardingContactFields';
import type { SailingCardOnboardingLockedIdentity } from './SailingCardOnboardingFormTypes';
import {
  AffiliationSelect,
  AgreementSection,
  IdentityFields,
} from './SailingCardOnboardingIdentityFields';

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
  readonly clientErrors: FieldErrors<SailingCardOnboardingFormValues>;
  readonly dateOfBirthValue: string | undefined;
  readonly fitnessMembershipReady: boolean;
  readonly hasFitnessMembershipValue: string | undefined;
  readonly hasVerifiedMitRecreationMembership?: boolean;
  readonly isPending: boolean;
  readonly now: Date;
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly setValue: UseFormSetValue<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  return (
    <>
      <ContactAndSafetyFields
        clientErrors={props.clientErrors}
        register={props.register}
        state={props.state}
      />
      <CardRequestSection
        affiliation={props.affiliation}
        cardTypeValue={props.cardTypeValue}
        clientErrors={props.clientErrors}
        dateOfBirthValue={props.dateOfBirthValue}
        fitnessMembershipReady={props.fitnessMembershipReady}
        hasFitnessMembershipValue={props.hasFitnessMembershipValue}
        hasVerifiedMitRecreationMembership={
          props.hasVerifiedMitRecreationMembership
        }
        now={props.now}
        register={props.register}
        setValue={props.setValue}
        state={props.state}
      />
      <AgreementSection
        clientErrors={props.clientErrors}
        register={props.register}
        state={props.state}
      />
      <SubmitButton isPending={props.isPending} />
    </>
  );
}

export function OnboardingFormFields(props: {
  readonly affiliation: SailingAffiliation | '';
  readonly canContinueIdentity: boolean;
  readonly cardTypeValue: string | undefined;
  readonly clientErrors: FieldErrors<SailingCardOnboardingFormValues>;
  readonly dateOfBirthValue: string | undefined;
  readonly fitnessMembershipReady: boolean;
  readonly hasFitnessMembershipValue: string | undefined;
  readonly hasVerifiedMitRecreationMembership?: boolean;
  readonly identityContinueMode: 'continue' | 'skipMitId' | 'validateMitId';
  readonly identityValidationPending: boolean;
  readonly isPending: boolean;
  readonly lockedIdentity?: SailingCardOnboardingLockedIdentity;
  readonly manualNameRequired: boolean;
  readonly mitIdRequired: boolean;
  readonly now: Date;
  readonly onContinueIdentity: () => void;
  readonly onValidateMitIdentity: () => void;
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
        clientErrors={props.clientErrors}
        hasVerifiedMitRecreationMembership={
          props.hasVerifiedMitRecreationMembership
        }
        register={props.register}
        setValue={props.setValue}
        state={props.state}
      />
      {props.affiliation === '' ? null : (
        <IdentityFields
          canContinue={props.canContinueIdentity}
          clientErrors={props.clientErrors}
          continueMode={props.identityContinueMode}
          isValidationPending={props.identityValidationPending}
          lockedIdentity={props.lockedIdentity}
          manualNameRequired={props.manualNameRequired}
          mitIdRequired={props.mitIdRequired}
          onContinue={props.onContinueIdentity}
          onValidateMitId={props.onValidateMitIdentity}
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
          clientErrors={props.clientErrors}
          dateOfBirthValue={props.dateOfBirthValue}
          fitnessMembershipReady={props.fitnessMembershipReady}
          hasFitnessMembershipValue={props.hasFitnessMembershipValue}
          hasVerifiedMitRecreationMembership={
            props.hasVerifiedMitRecreationMembership
          }
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
