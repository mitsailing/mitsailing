'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { safeStripeHostedPaymentHref } from '@/libs/stripe/stripeHostedPaymentHref';
import { useSailingCardOnboardingFormModel } from './SailingCardOnboardingFormModel';
import type { SailingCardOnboardingFormProps } from './SailingCardOnboardingFormModel';
import { OnboardingFormFields } from './SailingCardOnboardingFormSections';

export { defaultSailingCardOnboardingAction } from './SailingCardOnboardingFormModel';

type SailingCardOnboardingFormModel = ReturnType<
  typeof useSailingCardOnboardingFormModel
>;

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
  const checkoutHref = safeStripeHostedPaymentHref(props.checkoutUrl);

  if (checkoutHref === null) {
    return null;
  }

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
      {/* nosemgrep: typescript.react.security.audit.react-href-var.react-href-var -- safeStripeHostedPaymentHref restricts checkout links to Stripe-hosted HTTPS payment URLs. */}
      <a
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-mit-red px-5 py-2.5 font-semibold text-white no-underline shadow-xs transition hover:bg-mit-red/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mit-red"
        href={checkoutHref}
      >
        {t('membership_checkout_continue')}
      </a>
      <p className="max-w-md text-xs leading-5 text-muted-foreground">
        {t('membership_checkout_profile_note')}
      </p>
    </section>
  );
}

function OnboardingFormFieldsForModel(props: {
  readonly model: SailingCardOnboardingFormModel;
}) {
  return (
    <OnboardingFormFields
      affiliation={props.model.affiliation}
      canContinueIdentity={props.model.canContinueIdentity}
      cardTypeValue={props.model.cardTypeValue}
      dateOfBirthValue={props.model.dateOfBirthValue}
      fitnessMembershipReady={props.model.fitnessMembershipReady}
      hasFitnessMembershipValue={props.model.hasFitnessMembershipValue}
      identityContinueMode={props.model.identityContinueMode}
      identityComplete={props.model.identityComplete}
      identityValidationPending={props.model.identityValidationPending}
      isPending={props.model.isPending}
      clientErrors={props.model.form.formState.errors}
      lockedIdentity={props.model.lockedIdentity}
      manualNameRequired={props.model.manualNameRequired}
      mitIdRequired={props.model.mitIdRequired}
      now={props.model.now}
      hasVerifiedMitRecreationMembership={
        props.model.hasVerifiedMitRecreationMembership
      }
      onContinueIdentity={props.model.handleContinueIdentity}
      onValidateMitIdentity={props.model.handleValidateMitIdentity}
      register={props.model.form.register}
      setValue={props.model.form.setValue}
      showDetails={props.model.showDetails}
      showLockedIdentity={props.model.identityVisibility.showLockedIdentity}
      showManualName={props.model.identityVisibility.showManualName}
      showMitId={props.model.identityVisibility.showMitId}
      state={props.model.state}
    />
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
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <HostedMembershipCheckoutPrompt
          checkoutUrl={props.initialMembershipCheckoutUrl}
        />
        <form
          autoComplete="on"
          ref={formRef}
          className="flex w-full flex-col gap-6 text-sm"
          onSubmit={model.handleSubmit}
        >
          <OnboardingFormErrorAlert formError={model.state.formError} />
          <OnboardingFormFieldsForModel model={model} />
        </form>
      </div>
    );
  }

  return (
    <form
      autoComplete="on"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 text-sm"
      ref={formRef}
      onSubmit={model.handleSubmit}
    >
      <OnboardingFormErrorAlert formError={model.state.formError} />
      <OnboardingFormFieldsForModel model={model} />
    </form>
  );
}
