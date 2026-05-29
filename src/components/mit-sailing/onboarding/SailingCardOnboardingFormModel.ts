'use client';

import { useActionState, useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import type { SailingAffiliation } from '@/generated/prisma/enums';
import { hasAutomaticFitnessMembership } from '@/libs/mit-sailing/sailingCardMembership';
import { submitSailingCardOnboardingAction } from '@/libs/mit-sailing/sailingCardOnboardingActions';
import type {
  SailingCardOnboardingFormState,
  SailingCardOnboardingFormValues,
} from '@/libs/mit-sailing/sailingCardOnboardingActions';
import {
  formDataFromReactHookFormValues,
  getVisibleSailingAffiliation,
  getVisibleSailingAffiliationRule,
  isManualNameRequired,
  showManualNameForRule,
  showMitIdForRule,
} from './SailingCardOnboardingFormHelpers';
import type { SailingCardOnboardingLockedIdentity } from './SailingCardOnboardingFormTypes';

export const defaultSailingCardOnboardingAction =
  submitSailingCardOnboardingAction;

export type SailingCardOnboardingFormProps = {
  readonly action?: (
    previousState: SailingCardOnboardingFormState,
    formData: FormData
  ) => Promise<SailingCardOnboardingFormState>;
  readonly callbackUrl?: string;
  readonly initialValues?: SailingCardOnboardingFormValues;
  readonly lockedIdentity?: SailingCardOnboardingLockedIdentity;
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
  readonly lockedIdentity?: SailingCardOnboardingLockedIdentity;
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
  readonly lockedIdentity?: SailingCardOnboardingLockedIdentity;
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
  readonly lockedIdentity?: SailingCardOnboardingLockedIdentity;
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

const watchedOnboardingFieldNames = [
  'affiliation',
  'mitId',
  'firstName',
  'lastName',
  'dateOfBirth',
  'hasFitnessMembership',
  'cardType',
] as const;

function useOnboardingActionRuntime(props: SailingCardOnboardingFormProps) {
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
  const handleSubmit = form.handleSubmit((values) => {
    startTransition(() => {
      formAction(
        formDataFromReactHookFormValues({
          callbackUrl: props.callbackUrl,
          values,
        })
      );
    });
  });

  return {
    form,
    handleContinueIdentity: () => {
      setDetailsUnlocked(true);
    },
    handleSubmit,
    isPending,
    now,
    state,
    detailsUnlocked,
  };
}

function useWatchedOnboardingValues(
  control: Control<SailingCardOnboardingFormValues>
) {
  const [
    affiliationValue,
    mitIdValue,
    firstNameValue,
    lastNameValue,
    dateOfBirthValue,
    hasFitnessMembershipValue,
    cardTypeValue,
  ] = useWatch({
    control,
    name: watchedOnboardingFieldNames,
  });

  return {
    affiliationValue,
    cardTypeValue,
    dateOfBirthValue,
    firstNameValue,
    hasFitnessMembershipValue,
    lastNameValue,
    mitIdValue,
  };
}

function getOnboardingIdentityModel(props: {
  readonly affiliation: SailingAffiliation | '';
  readonly lockedIdentity?: SailingCardOnboardingLockedIdentity;
  readonly values: ReturnType<typeof useWatchedOnboardingValues>;
}) {
  const rule = getVisibleSailingAffiliationRule(props.affiliation);
  const identityVisibility = getIdentityVisibility({
    lockedIdentity: props.lockedIdentity,
    rule,
  });
  const identityComplete = isIdentityComplete({
    firstNameValue: props.values.firstNameValue,
    lastNameValue: props.values.lastNameValue,
    lockedIdentity: props.lockedIdentity,
    mitIdValue: props.values.mitIdValue,
    rule,
    showLockedIdentity: identityVisibility.showLockedIdentity,
    showManualName: identityVisibility.showManualName,
    showMitId: identityVisibility.showMitId,
  });

  return {
    identityComplete,
    identityVisibility,
    manualNameRequired: isManualNameRequired({
      mitIdValue: props.values.mitIdValue,
      rule,
      showManualName: identityVisibility.showManualName,
    }),
    mitIdRequired: rule?.mitIdMode === 'required',
  };
}

export function useSailingCardOnboardingFormModel(
  props: SailingCardOnboardingFormProps
) {
  const runtime = useOnboardingActionRuntime(props);
  const values = useWatchedOnboardingValues(runtime.form.control);
  const affiliation = getVisibleSailingAffiliation(values.affiliationValue);
  const identity = getOnboardingIdentityModel({
    affiliation,
    lockedIdentity: props.lockedIdentity,
    values,
  });

  return {
    affiliation,
    cardTypeValue: values.cardTypeValue,
    dateOfBirthValue: values.dateOfBirthValue,
    fitnessMembershipReady: isFitnessMembershipReady({
      affiliation,
      hasFitnessMembershipValue: values.hasFitnessMembershipValue,
    }),
    form: runtime.form,
    handleContinueIdentity: runtime.handleContinueIdentity,
    handleSubmit: runtime.handleSubmit,
    identityComplete: identity.identityComplete,
    identityVisibility: identity.identityVisibility,
    isPending: runtime.isPending,
    lockedIdentity: props.lockedIdentity,
    manualNameRequired: identity.manualNameRequired,
    mitIdRequired: identity.mitIdRequired,
    now: runtime.now,
    showDetails: shouldShowDetails({
      detailsUnlocked: runtime.detailsUnlocked,
      identityComplete: identity.identityComplete,
      state: runtime.state,
    }),
    state: runtime.state,
  };
}
