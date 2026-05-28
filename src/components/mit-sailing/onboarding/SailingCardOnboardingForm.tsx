'use client';

import {
  defaultSailingCardOnboardingAction,
  useSailingCardOnboardingFormModel,
} from './SailingCardOnboardingFormModel';
import type { SailingCardOnboardingFormProps } from './SailingCardOnboardingFormModel';
import { OnboardingFormFields } from './SailingCardOnboardingFormSections';

export { defaultSailingCardOnboardingAction };

export function SailingCardOnboardingForm(
  props: SailingCardOnboardingFormProps
) {
  const model = useSailingCardOnboardingFormModel(props);

  return (
    <form
      className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded border border-border bg-background p-4 text-sm shadow-sm"
      onSubmit={model.handleSubmit}
    >
      <OnboardingFormFields
        affiliation={model.affiliation}
        cardTypeValue={model.cardTypeValue}
        dateOfBirthValue={model.dateOfBirthValue}
        fitnessMembershipReady={model.fitnessMembershipReady}
        identityComplete={model.identityComplete}
        isPending={model.isPending}
        lockedIdentity={model.lockedIdentity}
        manualNameRequired={model.manualNameRequired}
        mitIdRequired={model.mitIdRequired}
        now={model.now}
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
