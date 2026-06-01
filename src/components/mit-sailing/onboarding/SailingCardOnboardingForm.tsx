'use client';

import { useEffect, useRef } from 'react';
import { useSailingCardOnboardingFormModel } from './SailingCardOnboardingFormModel';
import type { SailingCardOnboardingFormProps } from './SailingCardOnboardingFormModel';
import { OnboardingFormFields } from './SailingCardOnboardingFormSections';

export { defaultSailingCardOnboardingAction } from './SailingCardOnboardingFormModel';

export function SailingCardOnboardingForm(
  props: SailingCardOnboardingFormProps
) {
  const model = useSailingCardOnboardingFormModel(props);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (model.state.status !== 'error') {
      return;
    }
    formRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, [model.state]);

  return (
    <form
      ref={formRef}
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 text-sm"
      onSubmit={model.handleSubmit}
    >
      <OnboardingFormFields
        affiliation={model.affiliation}
        cardTypeValue={model.cardTypeValue}
        dateOfBirthValue={model.dateOfBirthValue}
        fitnessMembershipReady={model.fitnessMembershipReady}
        hasFitnessMembershipValue={model.hasFitnessMembershipValue}
        identityComplete={model.identityComplete}
        isPending={model.isPending}
        clientErrors={model.form.formState.errors}
        lockedIdentity={model.lockedIdentity}
        manualNameRequired={model.manualNameRequired}
        mitIdRequired={model.mitIdRequired}
        now={model.now}
        hasVerifiedMitRecreationMembership={
          model.hasVerifiedMitRecreationMembership
        }
        onContinueIdentity={model.handleContinueIdentity}
        register={model.form.register}
        setValue={model.form.setValue}
        showDetails={model.showDetails}
        showLockedIdentity={model.identityVisibility.showLockedIdentity}
        showManualName={model.identityVisibility.showManualName}
        showMitId={model.identityVisibility.showMitId}
        state={model.state}
      />
    </form>
  );
}
