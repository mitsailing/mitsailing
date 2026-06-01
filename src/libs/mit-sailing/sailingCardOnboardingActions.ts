'use server';

import { getLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  LegalAgreementAcceptanceSource,
  SailingAffiliation,
  SailingCardRequestStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import {
  authHrefWithCallback,
  safeAuthCallbackUrl,
} from '@/libs/auth/callbackUrl';
import { getSession } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { createMembershipCheckoutUrlForOnboarding } from '@/libs/mit-sailing/membershipBilling/membershipCheckoutActions';
import {
  lookupMitDataWarehouseIdentity,
  verifiedKerberosFromEmail,
} from '@/libs/mit-sailing/mitDataWarehouse';
import {
  sailingCardAgreement,
  sailingCardAgreementHash,
} from '@/libs/mit-sailing/sailingCardAgreement';
import { needsFitnessMembershipQuestion } from '@/libs/mit-sailing/sailingCardMembership';
import {
  buildSailingCardOnboardingUpdate,
  SailingCardOnboardingValidationError,
} from '@/libs/mit-sailing/sailingCardOnboarding';
import type {
  SailingCardOnboardingFieldErrors,
  SailingCardOnboardingInput,
} from '@/libs/mit-sailing/sailingCardOnboarding';
import {
  getCurrentSailingCardYear,
  hasCompletedCurrentYearSailingCardRequest,
} from '@/libs/mit-sailing/sailingCardValidity';
import { getI18nPath } from '@/utils/Helpers';

export type SailingCardOnboardingFormState = {
  readonly fieldErrors: SailingCardOnboardingFieldErrors;
  readonly formError?: 'membership_checkout_unavailable';
  readonly status: 'error' | 'idle';
  readonly values: SailingCardOnboardingFormValues;
};

export type SailingCardOnboardingFormValues = {
  readonly affiliation: string;
  readonly cardType: string;
  readonly dateOfBirth: string;
  readonly emergencyContactName: string;
  readonly emergencyContactPhone: string;
  readonly firstName: string;
  readonly hasFitnessMembership: string;
  readonly lastName: string;
  readonly mitId: string;
  readonly phone: string;
  readonly swimAgreementAccepted: boolean;
};

const formDataString = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
};

const postOnboardingDestination = (props: {
  readonly callbackUrl: string;
  readonly successHref: string;
}) => {
  const callbackUrl = safeAuthCallbackUrl(props.callbackUrl, props.successHref);

  return callbackUrl.startsWith('/onboarding')
    ? props.successHref
    : callbackUrl;
};

const currentYearSailingCardRequestSelect = {
  cardYear: true,
  cardType: true,
  hasFitnessMembership: true,
  legalAgreementAcceptance: {
    select: {
      agreementHash: true,
      agreementVersion: true,
      source: true,
      userId: true,
    },
  },
  sailingAffiliation: true,
  status: true,
  userId: true,
  user: {
    select: {
      emergencyContactName: true,
      emergencyContactPhone: true,
      phone: true,
    },
  },
} as const;

const canUpdatePendingNormalFitnessVerification = (request: {
  readonly cardType?: SailingCardType | null;
  readonly hasFitnessMembership?: boolean | null;
  readonly sailingAffiliation?: SailingAffiliation | null;
  readonly status: string;
}) =>
  request.status === SailingCardRequestStatus.pending &&
  request.cardType === SailingCardType.normal &&
  request.hasFitnessMembership !== true &&
  request.sailingAffiliation !== null &&
  request.sailingAffiliation !== undefined &&
  needsFitnessMembershipQuestion(request.sailingAffiliation);

const shouldRedirectCompletedCurrentYearRequest = (
  request: Parameters<typeof hasCompletedCurrentYearSailingCardRequest>[0]
) =>
  request !== null &&
  request.status !== 'cancelled' &&
  hasCompletedCurrentYearSailingCardRequest(request) &&
  !canUpdatePendingNormalFitnessVerification(request);

const sailingCardRequestUpdateData = (props: {
  readonly acceptedAt: Date;
  readonly cardType: SailingCardType;
  readonly dateOfBirth: Date;
  readonly legalAgreementAcceptanceId: string;
  readonly update: ReturnType<typeof buildSailingCardOnboardingUpdate>;
}) => ({
  cardType: props.cardType,
  dateOfBirth: props.dateOfBirth,
  emergencyContactName: props.update.emergencyContactName,
  emergencyContactPhone: props.update.emergencyContactPhone,
  firstName: props.update.firstName,
  hasFitnessMembership: props.update.hasFitnessMembership,
  lastName: props.update.lastName,
  legalAgreementAcceptanceId: props.legalAgreementAcceptanceId,
  mitClassYear: props.update.mitClassYear,
  mitId: props.update.mitId,
  phone: props.update.phone,
  requestedAt: props.acceptedAt,
  sailingAffiliation: props.update.sailingAffiliation,
  status: SailingCardRequestStatus.pending,
});

const parseAffiliation = (value: string) => {
  const affiliations: ReadonlySet<SailingAffiliation> = new Set(
    Object.values(SailingAffiliation).filter(
      (affiliation) => affiliation !== SailingAffiliation.NON_MIT
    )
  );
  for (const affiliation of affiliations) {
    if (value === affiliation) {
      return affiliation;
    }
  }
  return null;
};

const parseCardType = (value: string) => {
  const cardTypes: ReadonlySet<SailingCardType> = new Set(
    Object.values(SailingCardType)
  );
  for (const cardType of cardTypes) {
    if (value === cardType) {
      return cardType;
    }
  }
  return null;
};

const parseFitnessMembership = (value: string) => {
  if (value === 'yes') {
    return true;
  }
  if (value === 'no') {
    return false;
  }
  return null;
};

const parseAgreementAccepted = (formData: FormData) =>
  formData.get('swimAgreementAccepted') === 'on';

const firstForwardedIp = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const [first] = value.split(',');
  const trimmed = first?.trim();
  return trimmed && trimmed.length > 0 ? trimmed.slice(0, 80) : null;
};

const truncateMetadata = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 500) : null;
};

const parseSailingCardOnboardingFormValues = (
  formData: FormData
): SailingCardOnboardingFormValues => ({
  affiliation: formDataString(formData, 'affiliation'),
  cardType: formDataString(formData, 'cardType'),
  dateOfBirth: formDataString(formData, 'dateOfBirth'),
  emergencyContactName: formDataString(formData, 'emergencyContactName'),
  emergencyContactPhone: formDataString(formData, 'emergencyContactPhone'),
  firstName: formDataString(formData, 'firstName'),
  hasFitnessMembership: formDataString(formData, 'hasFitnessMembership'),
  lastName: formDataString(formData, 'lastName'),
  mitId: formDataString(formData, 'mitId'),
  phone: formDataString(formData, 'phone'),
  swimAgreementAccepted: parseAgreementAccepted(formData),
});

const parseSailingCardOnboardingFormData = (
  formData: FormData
): SailingCardOnboardingInput => {
  const values = parseSailingCardOnboardingFormValues(formData);

  return {
    affiliation: parseAffiliation(values.affiliation),
    cardType: parseCardType(values.cardType),
    dateOfBirth: values.dateOfBirth,
    emergencyContactName: values.emergencyContactName,
    emergencyContactPhone: values.emergencyContactPhone,
    hasFitnessMembership: parseFitnessMembership(values.hasFitnessMembership),
    mitId: values.mitId,
    firstName: values.firstName,
    lastName: values.lastName,
    phone: values.phone,
    swimAgreementAccepted: values.swimAgreementAccepted,
  };
};

const formStateFromValidationError = (props: {
  readonly error: SailingCardOnboardingValidationError;
  readonly formData: FormData;
}): SailingCardOnboardingFormState => ({
  fieldErrors: props.error.fieldErrors,
  status: 'error',
  values: parseSailingCardOnboardingFormValues(props.formData),
});

const formStateFromMembershipCheckoutError = (
  formData: FormData
): SailingCardOnboardingFormState => ({
  fieldErrors: {},
  formError: 'membership_checkout_unavailable',
  status: 'error',
  values: parseSailingCardOnboardingFormValues(formData),
});

const hasVerifiedMitRecreationMembership = (value: Date | null | undefined) =>
  value !== null && value !== undefined;

const revalidateOnboardingDestination = (props: {
  readonly destination: string;
  readonly successHref: string;
}) => {
  revalidatePath(props.successHref);
  if (props.destination !== props.successHref) {
    revalidatePath(props.destination);
  }
};

const absoluteAppUrl = (path: string) =>
  new URL(path, Env.NEXT_PUBLIC_APP_URL).toString();

const checkoutSuccessUrl = (successHref: string) => {
  const successUrl = absoluteAppUrl(successHref);
  return `${successUrl}${
    successUrl.includes('?') ? '&' : '?'
  }session_id={CHECKOUT_SESSION_ID}`;
};

const membershipCheckoutStateForOnboarding = async (props: {
  readonly cardType: SailingCardType;
  readonly dateOfBirth: Date;
  readonly locale: string;
  readonly sailingAffiliation: SailingAffiliation;
  readonly userEmail: string;
  readonly userId: string;
  readonly userName: string | null;
}): Promise<
  | { readonly status: 'created'; readonly url: string }
  | { readonly status: 'failed' }
  | { readonly status: 'not_required' }
> => {
  if (props.cardType === SailingCardType.normal) {
    return { status: 'not_required' };
  }
  const successHref = getI18nPath('/onboarding/success', props.locale);
  let checkout: Awaited<
    ReturnType<typeof createMembershipCheckoutUrlForOnboarding>
  >;
  try {
    checkout = await createMembershipCheckoutUrlForOnboarding({
      cancelUrl: absoluteAppUrl(
        getI18nPath('/onboarding?checkout=cancelled', props.locale)
      ),
      cardType: props.cardType,
      dateOfBirth: props.dateOfBirth.toISOString().slice(0, 10),
      email: props.userEmail,
      name: props.userName,
      sailingAffiliation: props.sailingAffiliation,
      successUrl: checkoutSuccessUrl(successHref),
      userId: props.userId,
    });
  } catch {
    return { status: 'failed' };
  }
  if (checkout?.status !== 'created') {
    return { status: 'failed' };
  }
  return { status: 'created', url: checkout.url };
};

export const submitSailingCardOnboardingAction = async (
  _previousState: SailingCardOnboardingFormState,
  formData: FormData
): Promise<SailingCardOnboardingFormState> => {
  const locale = await getLocale();
  const session = await getSession();
  const successHref = getI18nPath('/onboarding/success', locale);
  const callbackUrl = formDataString(formData, 'callbackUrl');

  if (!session?.user?.id) {
    redirect(
      authHrefWithCallback(
        getI18nPath('/login', locale),
        authHrefWithCallback(getI18nPath('/onboarding', locale), callbackUrl)
      )
    );
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      emergencyContactName: true,
      emergencyContactPhone: true,
      gymMembershipVerifiedAt: true,
      legalAgreementAcceptances: {
        where: {
          agreementHash: sailingCardAgreementHash(),
          agreementVersion: sailingCardAgreement.version,
          source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
        },
        orderBy: { acceptedAt: 'desc' },
        select: {
          acceptedAt: true,
          agreementHash: true,
          agreementVersion: true,
        },
        take: 1,
      },
      phone: true,
      sailingCardIssuedByUserId: true,
      sailingCardNumber: true,
      sailingCardYear: true,
      sailingCardExpiresOn: true,
      sailingCardIssuedAt: true,
      sailingCardRequestedAt: true,
      sailingCardSwimAgreementInitials: true,
      sailingCardSwimAgreementInitialedAt: true,
      sailingCardRequests: {
        orderBy: { requestedAt: 'desc' },
        take: 1,
        where: {
          cardYear: getCurrentSailingCardYear(),
        },
        select: currentYearSailingCardRequestSelect,
      },
    },
  });

  if (currentUser === null) {
    redirect(
      authHrefWithCallback(
        getI18nPath('/login', locale),
        authHrefWithCallback(getI18nPath('/onboarding', locale), callbackUrl)
      )
    );
  }

  const latestRequest = currentUser.sailingCardRequests.at(0) ?? null;
  if (shouldRedirectCompletedCurrentYearRequest(latestRequest)) {
    redirect(successHref);
  }

  const input = parseSailingCardOnboardingFormData(formData);
  const verifiedKerberos = verifiedKerberosFromEmail({
    email: typeof session.user.email === 'string' ? session.user.email : null,
    emailVerified: session.user.emailVerified,
  });
  const dataWarehouseIdentity =
    input.mitId.trim() === ''
      ? null
      : await lookupMitDataWarehouseIdentity({
          mitId: input.mitId,
          verifiedKerberos,
        });
  let update: ReturnType<typeof buildSailingCardOnboardingUpdate>;
  try {
    update = buildSailingCardOnboardingUpdate({
      input,
      dataWarehouseIdentity,
      hasVerifiedMitRecreationMembership: hasVerifiedMitRecreationMembership(
        currentUser.gymMembershipVerifiedAt
      ),
      now: new Date(),
    });
  } catch (error) {
    if (error instanceof SailingCardOnboardingValidationError) {
      return formStateFromValidationError({ error, formData });
    }
    throw error;
  }

  const headerList = await headers();
  const ipAddress =
    firstForwardedIp(headerList.get('x-forwarded-for')) ??
    truncateMetadata(headerList.get('x-real-ip'))?.slice(0, 80) ??
    null;
  const userAgent = truncateMetadata(headerList.get('user-agent'));
  const acceptedAt = new Date();
  const cardYear = getCurrentSailingCardYear(acceptedAt);
  const { cardType, dateOfBirth } = update;
  const userUpdate = {
    emergencyContactName: update.emergencyContactName,
    emergencyContactPhone: update.emergencyContactPhone,
    firstName: update.firstName,
    lastName: update.lastName,
    mitClassYear: update.mitClassYear,
    mitDataWarehouseVerifiedAt: update.mitDataWarehouseVerifiedAt,
    mitId: update.mitId,
    name: update.name,
    phone: update.phone,
    sailingAffiliation: update.sailingAffiliation,
    sailingCardRequestedAt: update.sailingCardRequestedAt,
  };

  const transactionResult = await prisma.$transaction(async (tx) => {
    const currentYearRequest = await tx.sailingCardRequest.findUnique({
      where: {
        userId_cardYear: {
          cardYear,
          userId: session.user.id,
        },
      },
      select: currentYearSailingCardRequestSelect,
    });
    if (shouldRedirectCompletedCurrentYearRequest(currentYearRequest)) {
      return { status: 'alreadyCompleted' } as const;
    }

    const legalAgreementAcceptance = await tx.legalAgreementAcceptance.create({
      data: {
        acceptedAt,
        agreementHash: sailingCardAgreementHash(),
        agreementLabel: sailingCardAgreement.label,
        agreementVersion: sailingCardAgreement.version,
        ipAddress,
        source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
        sourceRecordId: null,
        userAgent,
        userId: session.user.id,
      },
    });
    await tx.user.update({
      where: { id: session.user.id },
      data: userUpdate,
    });
    const requestData = sailingCardRequestUpdateData({
      acceptedAt,
      cardType,
      dateOfBirth,
      legalAgreementAcceptanceId: legalAgreementAcceptance.id,
      update,
    });

    if (currentYearRequest === null) {
      await tx.sailingCardRequest.create({
        data: {
          ...requestData,
          cardYear,
          userId: session.user.id,
        },
      });
    } else {
      const requestUpdate = await tx.sailingCardRequest.updateMany({
        where: {
          cardYear,
          status: SailingCardRequestStatus.pending,
          userId: session.user.id,
        },
        data: requestData,
      });

      if (requestUpdate.count === 0) {
        redirect(successHref);
      }
    }

    return { status: 'submitted' } as const;
  });

  if (transactionResult.status === 'alreadyCompleted') {
    redirect(successHref);
  }

  const destination = postOnboardingDestination({ callbackUrl, successHref });

  revalidateOnboardingDestination({ destination, successHref });
  const checkout = await membershipCheckoutStateForOnboarding({
    cardType,
    dateOfBirth,
    locale,
    sailingAffiliation: update.sailingAffiliation,
    userEmail: typeof session.user.email === 'string' ? session.user.email : '',
    userId: session.user.id,
    userName: typeof session.user.name === 'string' ? session.user.name : null,
  });
  if (checkout.status === 'created') {
    redirect(checkout.url);
  }
  if (checkout.status === 'failed') {
    return formStateFromMembershipCheckoutError(formData);
  }
  redirect(destination);
};
