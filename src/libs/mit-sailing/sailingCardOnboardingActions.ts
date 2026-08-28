'use server';

import { getLocale } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  LegalAgreementAcceptanceSource,
  MitDataWarehousePersonType,
  PaymentPurpose,
  PaymentStatus,
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
import { logger } from '@/libs/Logger';
import { createMembershipCheckoutUrlForOnboarding } from '@/libs/mit-sailing/membershipBilling/membershipCheckoutActions';
import {
  lookupMitDataWarehouseIdentity,
  verifiedKerberosFromEmail,
} from '@/libs/mit-sailing/mitDataWarehouse';
import { normalizeVerifiedMitDataWarehousePersonName } from '@/libs/mit-sailing/personName';
import {
  sailingCardAgreement,
  sailingCardAgreementHash,
} from '@/libs/mit-sailing/sailingCardAgreement';
import { needsFitnessMembershipQuestion } from '@/libs/mit-sailing/sailingCardMembership';
import { sailingCardRequestNeedsMembershipPayment } from '@/libs/mit-sailing/sailingCardMembershipPaymentRequirement';
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

export type VerifySailingCardOnboardingMitIdentityResult =
  | {
      readonly identity: {
        readonly firstName: string;
        readonly lastName: string;
        readonly mitClassYear: string | null;
        readonly mitId: string;
      };
      readonly ok: true;
    }
  | {
      readonly fieldError:
        | 'affiliation_mismatch'
        | 'invalid_dw_identity'
        | 'required_dw_identity';
      readonly ok: false;
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
      acceptedUserId: true,
    },
  },
  sailingAffiliation: true,
  status: true,
  userId: true,
  user: {
    select: {
      emergencyContactName: true,
      emergencyContactPhone: true,
      gymMembershipVerifiedAt: true,
      phone: true,
    },
  },
} as const;

type CurrentYearSailingCardRequest = NonNullable<
  Parameters<typeof hasCompletedCurrentYearSailingCardRequest>[0]
> & {
  readonly cardType: SailingCardType;
  readonly hasFitnessMembership: boolean | null;
  readonly sailingAffiliation: SailingAffiliation | null;
  readonly user: NonNullable<
    Parameters<typeof hasCompletedCurrentYearSailingCardRequest>[0]
  >['user'] & {
    readonly gymMembershipVerifiedAt: Date | null;
  };
};

type PaidMembershipPaymentClient = {
  readonly payment: {
    readonly findFirst: (args: {
      readonly select: { readonly id: true };
      readonly where: {
        readonly cardType: SailingCardType;
        readonly cardYear: number;
        readonly purpose: typeof PaymentPurpose.membership;
        readonly status: typeof PaymentStatus.paid;
        readonly userId: string;
      };
    }) => Promise<{ readonly id: string } | null>;
  };
};

const canUpdatePendingNormalFitnessVerification = (request: {
  readonly cardType?: SailingCardType | null;
  readonly hasFitnessMembership?: boolean | null;
  readonly sailingAffiliation?: SailingAffiliation | null;
  readonly status: CurrentYearSailingCardRequest['status'];
}) =>
  request.status === SailingCardRequestStatus.pending &&
  request.cardType === SailingCardType.normal &&
  request.hasFitnessMembership !== true &&
  request.sailingAffiliation !== null &&
  request.sailingAffiliation !== undefined &&
  needsFitnessMembershipQuestion(request.sailingAffiliation);

const shouldRedirectCompletedCurrentYearRequest = (
  request: CurrentYearSailingCardRequest | null
) =>
  request !== null &&
  request.status !== SailingCardRequestStatus.cancelled &&
  hasCompletedCurrentYearSailingCardRequest(request) &&
  !canUpdatePendingNormalFitnessVerification(request);

async function hasPaidCurrentYearMembershipPayment(props: {
  readonly cardType: SailingCardType;
  readonly cardYear: number;
  readonly client: PaidMembershipPaymentClient;
  readonly userId: string;
}) {
  const payment = await props.client.payment.findFirst({
    select: { id: true },
    where: {
      cardType: props.cardType,
      cardYear: props.cardYear,
      purpose: PaymentPurpose.membership,
      status: PaymentStatus.paid,
      userId: props.userId,
    },
  });
  return payment !== null;
}

function currentYearRequestShouldFinishOnboarding(props: {
  readonly cardYear: number;
  readonly client: PaidMembershipPaymentClient;
  readonly request: CurrentYearSailingCardRequest | null;
  readonly userId: string;
}): boolean | Promise<boolean> {
  const { request } = props;
  if (request === null) {
    return false;
  }
  if (!shouldRedirectCompletedCurrentYearRequest(request)) {
    return false;
  }
  if (!sailingCardRequestNeedsMembershipPayment(request)) {
    return true;
  }
  return hasPaidCurrentYearMembershipPayment({
    cardType: request.cardType,
    cardYear: props.cardYear,
    client: props.client,
    userId: props.userId,
  });
}

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
  const affiliations = Object.values(SailingAffiliation).filter(
    (affiliation) => affiliation !== SailingAffiliation.NON_MIT
  );
  return affiliations.find((affiliation) => affiliation === value) ?? null;
};

const requiredMitAffiliationMatchesIdentity = (props: {
  readonly affiliation: SailingAffiliation;
  readonly personType: MitDataWarehousePersonType;
}) => {
  if (props.affiliation === SailingAffiliation.MIT_STUDENT) {
    return props.personType === MitDataWarehousePersonType.CURRENT_STUDENT;
  }
  if (
    props.affiliation === SailingAffiliation.MIT_FACULTY ||
    props.affiliation === SailingAffiliation.MIT_STAFF
  ) {
    return props.personType === MitDataWarehousePersonType.CURRENT_STAFF;
  }
  return true;
};

export async function verifySailingCardOnboardingMitIdentityAction(props: {
  readonly affiliation: string;
  readonly mitId: string;
}): Promise<VerifySailingCardOnboardingMitIdentityResult> {
  const session = await getSession();
  const affiliation = parseAffiliation(props.affiliation);
  if (affiliation === null) {
    return { fieldError: 'affiliation_mismatch', ok: false };
  }
  if (props.mitId.trim() === '') {
    return { fieldError: 'required_dw_identity', ok: false };
  }

  const identity = await lookupMitDataWarehouseIdentity({
    mitId: props.mitId,
    verifiedKerberos: verifiedKerberosFromEmail({
      email:
        typeof session?.user?.email === 'string' ? session.user.email : null,
      emailVerified: session?.user?.emailVerified === true,
    }),
  });
  if (identity === null) {
    return { fieldError: 'invalid_dw_identity', ok: false };
  }
  if (
    !requiredMitAffiliationMatchesIdentity({
      affiliation,
      personType: identity.personType,
    })
  ) {
    return { fieldError: 'affiliation_mismatch', ok: false };
  }

  const personName = normalizeVerifiedMitDataWarehousePersonName(identity);

  return {
    identity: {
      firstName: personName.firstName,
      lastName: personName.lastName,
      mitClassYear: identity.classYear,
      mitId: identity.mitId,
    },
    ok: true,
  };
}

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

const onboardingSuccessHref = (props: {
  readonly destination: string;
  readonly successHref: string;
}) =>
  props.destination === props.successHref
    ? props.successHref
    : authHrefWithCallback(props.successHref, props.destination);

const errorName = (error: unknown) =>
  error instanceof Error ? error.name : 'unknown';

const errorCode = (error: unknown) => {
  if (error !== null && typeof error === 'object' && 'code' in error) {
    const { code } = error;
    if (typeof code === 'string' && code.trim() !== '') {
      return code;
    }
  }
  return 'unknown';
};

const membershipCheckoutStateForOnboarding = async (props: {
  readonly cardYear: number;
  readonly cardType: SailingCardType;
  readonly dateOfBirth: Date;
  readonly destination: string;
  readonly gymMembershipVerifiedAt: Date | null;
  readonly hasFitnessMembership: boolean | null;
  readonly locale: string;
  readonly sailingAffiliation: SailingAffiliation;
  readonly successHref: string;
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
  if (
    !sailingCardRequestNeedsMembershipPayment({
      cardType: props.cardType,
      hasFitnessMembership: props.hasFitnessMembership,
      sailingAffiliation: props.sailingAffiliation,
      user: { gymMembershipVerifiedAt: props.gymMembershipVerifiedAt },
    })
  ) {
    return { status: 'not_required' };
  }
  if (
    await hasPaidCurrentYearMembershipPayment({
      cardType: props.cardType,
      cardYear: props.cardYear,
      client: prisma,
      userId: props.userId,
    })
  ) {
    return { status: 'not_required' };
  }
  const checkoutSuccessHref = onboardingSuccessHref({
    destination: props.destination,
    successHref: props.successHref,
  });
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
      successUrl: checkoutSuccessUrl(checkoutSuccessHref),
      userId: props.userId,
    });
  } catch (error) {
    logger.error(
      '[sailing-card-onboarding:membership-checkout] user_id={userId} card_type={cardType} error_name={errorName} error_code={errorCode}',
      {
        cardType: props.cardType,
        error,
        errorCode: errorCode(error),
        errorName: errorName(error),
        userId: props.userId,
      }
    );
    return { status: 'failed' };
  }
  if (checkout?.status === 'not_eligible') {
    return { status: 'not_required' };
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
  const destination = postOnboardingDestination({ callbackUrl, successHref });
  const successDestination = onboardingSuccessHref({
    destination,
    successHref,
  });

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

  const cardYear = getCurrentSailingCardYear();
  const latestRequest = currentUser.sailingCardRequests.at(0) ?? null;
  if (
    await currentYearRequestShouldFinishOnboarding({
      cardYear,
      client: prisma,
      request: latestRequest,
      userId: session.user.id,
    })
  ) {
    redirect(successDestination);
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
    if (
      await currentYearRequestShouldFinishOnboarding({
        cardYear,
        client: tx,
        request: currentYearRequest,
        userId: session.user.id,
      })
    ) {
      return { status: 'alreadyCompleted' } as const;
    }

    const legalAgreementAcceptance = await tx.legalAgreementAcceptance.create({
      data: {
        acceptedAt,
        agreementHash: sailingCardAgreementHash(),
        agreementLabel: sailingCardAgreement.label,
        agreementVersion: sailingCardAgreement.version,
        acceptedUserEmail: session.user.email,
        acceptedUserId: session.user.id,
        acceptedUserName: update.name,
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
        if (
          await currentYearRequestShouldFinishOnboarding({
            cardYear,
            client: tx,
            request: currentYearRequest,
            userId: session.user.id,
          })
        ) {
          return { status: 'alreadyCompleted' } as const;
        }
        return { status: 'submitted' } as const;
      }
    }

    return { status: 'submitted' } as const;
  });

  if (transactionResult.status === 'alreadyCompleted') {
    redirect(successDestination);
  }

  revalidateOnboardingDestination({ destination, successHref });
  const checkout = await membershipCheckoutStateForOnboarding({
    cardYear,
    cardType,
    dateOfBirth,
    destination,
    gymMembershipVerifiedAt: currentUser.gymMembershipVerifiedAt,
    hasFitnessMembership: update.hasFitnessMembership,
    locale,
    sailingAffiliation: update.sailingAffiliation,
    successHref,
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
