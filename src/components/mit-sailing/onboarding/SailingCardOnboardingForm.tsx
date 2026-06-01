'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { useSailingCardOnboardingFormModel } from './SailingCardOnboardingFormModel';
import type { SailingCardOnboardingFormProps } from './SailingCardOnboardingFormModel';
import { OnboardingFormFields } from './SailingCardOnboardingFormSections';

export { defaultSailingCardOnboardingAction } from './SailingCardOnboardingFormModel';

function OnboardingFormErrorAlert(props: {
  readonly formError?: 'membership_checkout_unavailable';
}) {
  const t = useTranslations('OnboardingPage');

  if (props.formError === undefined) {
    return null;
  }

  return (
    <div
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive"
      role="alert"
    >
      {t(props.formError)}
    </div>
  );
}

function HostedMembershipCheckoutPrompt(props: {
  readonly checkoutUrl: string;
}) {
  const t = useTranslations('OnboardingPage');

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 text-center text-sm">
      <p className="text-xs font-semibold tracking-normal text-mit-red uppercase">
        {t('membership_checkout_eyebrow')}
      </p>
      <h2 className="text-2xl font-semibold tracking-normal text-foreground">
        {t('membership_checkout_heading')}
      </h2>
      <p className="max-w-md leading-6 text-muted-foreground">
        {t('membership_checkout_body')}
      </p>
      <a
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-mit-red px-5 py-2.5 font-semibold text-white no-underline shadow-xs transition hover:bg-mit-red/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mit-red"
        href={props.checkoutUrl}
      >
        {t('membership_checkout_continue')}
      </a>
      <p className="max-w-md text-xs leading-5 text-muted-foreground">
        {t('membership_checkout_profile_note')}
      </p>
    </section>
  );
}

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

  if (props.initialMembershipCheckoutUrl) {
    return (
      <HostedMembershipCheckoutPrompt
        checkoutUrl={props.initialMembershipCheckoutUrl}
      />
    );
  }

  return (
    <form
      ref={formRef}
      className="mx-auto flex w-full max-w-2xl flex-col gap-6 text-sm"
      onSubmit={model.handleSubmit}
    >
      <OnboardingFormErrorAlert formError={model.state.formError} />
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
