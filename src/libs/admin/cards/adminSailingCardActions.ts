'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import {
  PaymentPurpose,
  PaymentSource,
  PaymentStatus,
  LegalAgreementAcceptanceSource,
  SailingCardRequestStatus,
  SailingCardType,
  UserAuditAction,
} from '@/generated/prisma/enums';
import type { SailingAffiliation } from '@/generated/prisma/enums';
import { getNextAvailableSailingCardNumber } from '@/libs/admin/cards/adminSailingCardQueries';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import { prisma } from '@/libs/DB';
import {
  sailingCardAgreement,
  sailingCardAgreementHash,
} from '@/libs/mit-sailing/sailingCardAgreement';
import { needsFitnessMembershipQuestion } from '@/libs/mit-sailing/sailingCardMembership';
import {
  getCurrentSailingCardYear,
  getSailingCardExpirationDate,
} from '@/libs/mit-sailing/sailingCardValidity';
import { getI18nPath } from '@/utils/Helpers';

type AdminSailingCardFieldErrors = Partial<{
  readonly cardNumber: 'duplicate' | 'invalid';
}>;

type AdminSailingCardFormError =
  | 'missing_onboarding_agreement'
  | 'mit_recreation_required'
  | 'no_current_card'
  | 'not_pending_request'
  | 'not_found'
  | 'payment_required'
  | 'same_card_number';

export type AdminSailingCardActionState = {
  readonly fieldErrors: AdminSailingCardFieldErrors;
  readonly formError?: AdminSailingCardFormError;
  readonly status: 'error' | 'idle' | 'success';
};

type AdminSailingCardDb = Pick<
  Prisma.TransactionClient,
  'sailingCardRequest' | 'user' | 'userAudit'
>;
type AdminSailingCardIssueDb = Pick<
  Prisma.TransactionClient,
  'payment' | 'sailingCardRequest' | 'user' | 'userAudit'
>;

type SailingCardAuditFields = {
  readonly sailingCardExpiresOn: Date | null;
  readonly sailingCardIssuedAt: Date | null;
  readonly sailingCardIssuedByUserId: string | null;
  readonly sailingCardNumber: number | null;
  readonly sailingCardRequestedAt: Date | null;
  readonly sailingCardSwimAgreementInitialedAt: Date | null;
  readonly sailingCardSwimAgreementInitials: string | null;
  readonly sailingCardYear: number | null;
};

const sailingCardAuditSelect = {
  sailingCardExpiresOn: true,
  sailingCardIssuedAt: true,
  sailingCardIssuedByUserId: true,
  sailingCardNumber: true,
  sailingCardRequestedAt: true,
  sailingCardSwimAgreementInitialedAt: true,
  sailingCardSwimAgreementInitials: true,
  sailingCardYear: true,
} as const;

function formDataString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function parseManualCardNumber(formData: FormData) {
  const raw = formDataString(formData, 'cardNumber').trim();
  if (raw === '') {
    return null;
  }
  if (!/^[1-9]\d*$/.test(raw)) {
    return 'invalid';
  }
  return Number(raw);
}

function parseRequiredCardNumber(formData: FormData) {
  const cardNumber = parseManualCardNumber(formData);
  return cardNumber ?? 'invalid';
}

function parsePaymentBypassNote(formData: FormData) {
  const raw = formDataString(formData, 'paymentBypassNote').trim();
  return raw.length < 3 ? null : raw;
}

function jsonDate(date: Date | null) {
  return date?.toISOString() ?? null;
}

function sailingCardAuditValue(card: SailingCardAuditFields) {
  return {
    sailingCardExpiresOn: jsonDate(card.sailingCardExpiresOn),
    sailingCardIssuedAt: jsonDate(card.sailingCardIssuedAt),
    sailingCardIssuedByUserId: card.sailingCardIssuedByUserId,
    sailingCardNumber: card.sailingCardNumber,
    sailingCardRequestedAt: jsonDate(card.sailingCardRequestedAt),
    sailingCardSwimAgreementInitialedAt: jsonDate(
      card.sailingCardSwimAgreementInitialedAt
    ),
    sailingCardSwimAgreementInitials: card.sailingCardSwimAgreementInitials,
    sailingCardYear: card.sailingCardYear,
  };
}

function hasIssuedSailingCard(card: SailingCardAuditFields) {
  return (
    card.sailingCardExpiresOn !== null &&
    card.sailingCardIssuedAt !== null &&
    card.sailingCardNumber !== null &&
    card.sailingCardYear !== null
  );
}

function hasIssuedSailingCardForYear(
  card: SailingCardAuditFields,
  cardYear: number
) {
  return hasIssuedSailingCard(card) && card.sailingCardYear === cardYear;
}

async function findCurrentPendingSailingCardRequest(props: {
  readonly cardYear: number;
  readonly db: AdminSailingCardIssueDb;
  readonly userId: string;
}) {
  const request = await props.db.sailingCardRequest.findFirst({
    where: {
      cardYear: props.cardYear,
      status: SailingCardRequestStatus.pending,
      userId: props.userId,
    },
    select: {
      cardType: true,
      hasFitnessMembership: true,
      id: true,
      legalAgreementAcceptance: {
        select: {
          agreementHash: true,
          agreementVersion: true,
          source: true,
          userId: true,
        },
      },
      sailingAffiliation: true,
    },
  });
  return request;
}

function requestNeedsFitnessVerification(request: {
  readonly cardType: SailingCardType;
  readonly hasFitnessMembership: boolean | null;
  readonly sailingAffiliation: SailingAffiliation;
}) {
  return (
    request.cardType === SailingCardType.normal &&
    needsFitnessMembershipQuestion(request.sailingAffiliation) &&
    request.hasFitnessMembership !== true
  );
}

function requestNeedsPaymentBypass(cardType: SailingCardType) {
  return (
    cardType === SailingCardType.racing ||
    cardType === SailingCardType.team_racing
  );
}

async function hasRecordedMembershipPayment(props: {
  readonly cardType: SailingCardType;
  readonly cardYear: number;
  readonly db: AdminSailingCardIssueDb;
  readonly userId: string;
}) {
  const payment = await props.db.payment.findFirst({
    where: {
      cardType: props.cardType,
      cardYear: props.cardYear,
      purpose: PaymentPurpose.membership,
      status: { in: [PaymentStatus.handled, PaymentStatus.paid] },
      userId: props.userId,
    },
    select: { id: true },
  });
  return payment !== null;
}

function isSailingCardUniqueError(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return (
      (target.includes('sailingCardYear') &&
        target.includes('sailingCardNumber')) ||
      (target.includes('cardYear') && target.includes('issuedCardNumber'))
    );
  }
  return (
    typeof target === 'string' &&
    (target.includes('sailingCardYear_sailingCardNumber') ||
      target.includes('sailing_card_year_sailing_card_number') ||
      target.includes('cardYear_issuedCardNumber') ||
      target.includes('card_year_issued_card_number'))
  );
}

async function createSailingCardAudit(props: {
  readonly after: SailingCardAuditFields;
  readonly before: SailingCardAuditFields;
  readonly db: AdminSailingCardDb;
  readonly userId: string;
  readonly targetUserId: string;
}) {
  const latestAudit = await props.db.userAudit.findFirst({
    where: {
      auditableId: props.targetUserId,
      auditableType: 'user',
    },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  await props.db.userAudit.create({
    data: {
      auditableId: props.targetUserId,
      auditableType: 'user',
      action: UserAuditAction.update,
      auditedChanges: {
        after: sailingCardAuditValue(props.after),
        before: sailingCardAuditValue(props.before),
      },
      userId: props.userId,
      version: (latestAudit?.version ?? 0) + 1,
    },
  });
}

function revalidateSailingCardAdminPaths(locale: string, userId: string) {
  revalidatePath(
    getI18nPath(`/admin/users/${encodeURIComponent(userId)}`, locale)
  );
  revalidatePath(getI18nPath('/admin/users', locale));
  revalidatePath(getI18nPath('/onboarding', locale));
  revalidatePath(getI18nPath('/profile/account', locale));
}

function hasMatchingOnboardingAgreement(props: {
  readonly request: NonNullable<
    Awaited<ReturnType<typeof findCurrentPendingSailingCardRequest>>
  >;
  readonly targetUserId: string;
}) {
  return (
    props.request.legalAgreementAcceptance.agreementHash ===
      sailingCardAgreementHash() &&
    props.request.legalAgreementAcceptance.agreementVersion ===
      sailingCardAgreement.version &&
    props.request.legalAgreementAcceptance.source ===
      LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING &&
    props.request.legalAgreementAcceptance.userId === props.targetUserId
  );
}

function issueSailingCardErrorState(error: unknown) {
  if (error instanceof Error && error.message === 'card_number_duplicate') {
    return {
      fieldErrors: { cardNumber: 'duplicate' },
      status: 'error',
    } satisfies AdminSailingCardActionState;
  }
  if (isSailingCardUniqueError(error)) {
    return {
      fieldErrors: { cardNumber: 'duplicate' },
      status: 'error',
    } satisfies AdminSailingCardActionState;
  }
  if (!(error instanceof Error)) {
    return null;
  }
  if (
    error.message === 'not_found' ||
    error.message === 'missing_onboarding_agreement' ||
    error.message === 'mit_recreation_required' ||
    error.message === 'not_pending_request' ||
    error.message === 'payment_required'
  ) {
    return {
      fieldErrors: {},
      formError: error.message,
      status: 'error',
    } satisfies AdminSailingCardActionState;
  }
  return null;
}

async function assertCardNumberAvailable(props: {
  readonly cardNumber: number;
  readonly cardYear: number;
  readonly db: AdminSailingCardIssueDb;
  readonly requestId?: string;
  readonly targetUserId: string;
}) {
  const [issuedUserCount, issuedRequestCount] = await Promise.all([
    props.db.user.count({
      where: {
        id: { not: props.targetUserId },
        sailingCardNumber: props.cardNumber,
        sailingCardYear: props.cardYear,
      },
    }),
    props.db.sailingCardRequest.count({
      where: {
        cardYear: props.cardYear,
        ...(props.requestId ? { id: { not: props.requestId } } : {}),
        issuedCardNumber: props.cardNumber,
        userId: { not: props.targetUserId },
      },
    }),
  ]);
  if (issuedUserCount > 0 || issuedRequestCount > 0) {
    throw new Error('card_number_duplicate');
  }
}

export async function updateSailingCardNumberAction(
  locale: string,
  targetUserId: string,
  _previousState: AdminSailingCardActionState,
  formData: FormData
): Promise<AdminSailingCardActionState> {
  const session = await requirePermission(
    Permission.CARDS_ASSIGN_NUMBER,
    locale
  );
  const cardNumber = parseRequiredCardNumber(formData);
  if (cardNumber === 'invalid') {
    return {
      fieldErrors: { cardNumber: 'invalid' },
      status: 'error',
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({
        where: { id: targetUserId },
        select: sailingCardAuditSelect,
      });
      if (before === null) {
        throw new Error('not_found');
      }
      if (!hasIssuedSailingCard(before) || before.sailingCardYear === null) {
        throw new Error('no_current_card');
      }
      if (before.sailingCardNumber === cardNumber) {
        throw new Error('same_card_number');
      }
      await assertCardNumberAvailable({
        cardNumber,
        cardYear: before.sailingCardYear,
        db: tx,
        targetUserId,
      });
      const after = {
        ...before,
        sailingCardIssuedByUserId: session.user.id,
        sailingCardNumber: cardNumber,
      };
      await tx.sailingCardRequest.updateMany({
        where: {
          cardYear: before.sailingCardYear,
          status: SailingCardRequestStatus.approved,
          userId: targetUserId,
        },
        data: {
          issuedCardNumber: cardNumber,
        },
      });
      await tx.user.update({
        where: { id: targetUserId },
        data: after,
      });
      await createSailingCardAudit({
        after,
        before,
        db: tx,
        targetUserId,
        userId: session.user.id,
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'same_card_number') {
      return {
        fieldErrors: {},
        formError: 'same_card_number',
        status: 'error',
      };
    }
    if (error instanceof Error && error.message === 'no_current_card') {
      return {
        fieldErrors: {},
        formError: 'no_current_card',
        status: 'error',
      };
    }
    if (error instanceof Error && error.message === 'not_found') {
      return {
        fieldErrors: {},
        formError: 'not_found',
        status: 'error',
      };
    }
    if (isSailingCardUniqueError(error)) {
      return {
        fieldErrors: { cardNumber: 'duplicate' },
        status: 'error',
      };
    }
    throw error;
  }

  revalidateSailingCardAdminPaths(locale, targetUserId);
  return { fieldErrors: {}, status: 'success' };
}

export async function issueSailingCardAction(
  locale: string,
  targetUserId: string,
  _previousState: AdminSailingCardActionState,
  formData: FormData
): Promise<AdminSailingCardActionState> {
  const session = await requirePermission(
    Permission.CARDS_ASSIGN_NUMBER,
    locale
  );
  const manualCardNumber = parseManualCardNumber(formData);
  const paymentBypassNote = parsePaymentBypassNote(formData);
  if (manualCardNumber === 'invalid') {
    return {
      fieldErrors: { cardNumber: 'invalid' },
      status: 'error',
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const now = new Date();
      const cardYear = getCurrentSailingCardYear(now);
      const cardNumber =
        manualCardNumber ??
        (await getNextAvailableSailingCardNumber({
          cardYear,
          db: tx,
        }));
      const before = await tx.user.findUnique({
        where: { id: targetUserId },
        select: sailingCardAuditSelect,
      });
      if (before === null) {
        throw new Error('not_found');
      }
      if (hasIssuedSailingCardForYear(before, cardYear)) {
        throw new Error('not_pending_request');
      }
      const request = await findCurrentPendingSailingCardRequest({
        cardYear,
        db: tx,
        userId: targetUserId,
      });
      if (request === null) {
        throw new Error('not_pending_request');
      }
      if (!hasMatchingOnboardingAgreement({ request, targetUserId })) {
        throw new Error('missing_onboarding_agreement');
      }
      if (requestNeedsFitnessVerification(request)) {
        throw new Error('mit_recreation_required');
      }
      await assertCardNumberAvailable({
        cardNumber,
        cardYear,
        db: tx,
        requestId: request.id,
        targetUserId,
      });
      const needsPaymentBypass =
        requestNeedsPaymentBypass(request.cardType) &&
        !(await hasRecordedMembershipPayment({
          cardType: request.cardType,
          cardYear,
          db: tx,
          userId: targetUserId,
        }));
      if (needsPaymentBypass) {
        if (paymentBypassNote === null) {
          throw new Error('payment_required');
        }
        await tx.payment.create({
          data: {
            amountCents: 0,
            cardType: request.cardType,
            cardYear,
            currency: 'usd',
            manualHandledAt: now,
            manualHandledByUserId: session.user.id,
            manualHandledNote: paymentBypassNote,
            purpose: PaymentPurpose.membership,
            source: PaymentSource.admin_override,
            status: PaymentStatus.handled,
            userId: targetUserId,
          },
        });
      }
      const after = {
        ...before,
        sailingCardExpiresOn: getSailingCardExpirationDate(cardYear),
        sailingCardIssuedAt: now,
        sailingCardIssuedByUserId: session.user.id,
        sailingCardNumber: cardNumber,
        sailingCardRequestedAt: null,
        sailingCardYear: cardYear,
      };

      const approvedRequest = await tx.sailingCardRequest.updateMany({
        where: {
          cardYear,
          id: request.id,
          legalAgreementAcceptance: {
            agreementHash: sailingCardAgreementHash(),
            agreementVersion: sailingCardAgreement.version,
            source: LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING,
            userId: targetUserId,
          },
          status: SailingCardRequestStatus.pending,
          userId: targetUserId,
        },
        data: {
          approvedAt: now,
          approvedByUserId: session.user.id,
          issuedCardNumber: cardNumber,
          ...(needsPaymentBypass
            ? {
                paymentBypassAt: now,
                paymentBypassByUserId: session.user.id,
                paymentBypassNote,
              }
            : {}),
          status: SailingCardRequestStatus.approved,
        },
      });
      if (approvedRequest.count !== 1) {
        throw new Error('not_pending_request');
      }
      const issuedUser = await tx.user.updateMany({
        where: {
          id: targetUserId,
          OR: [
            { sailingCardYear: null },
            { sailingCardYear: { not: cardYear } },
          ],
        },
        data: after,
      });
      if (issuedUser.count !== 1) {
        throw new Error('not_pending_request');
      }
      await createSailingCardAudit({
        after,
        before,
        db: tx,
        targetUserId,
        userId: session.user.id,
      });
    });
  } catch (error) {
    const errorState = issueSailingCardErrorState(error);
    if (errorState) {
      return errorState;
    }
    throw error;
  }

  revalidateSailingCardAdminPaths(locale, targetUserId);
  return { fieldErrors: {}, status: 'success' };
}

export async function expireSailingCardAction(
  locale: string,
  targetUserId: string,
  _previousState: AdminSailingCardActionState,
  _formData: FormData
): Promise<AdminSailingCardActionState> {
  const session = await requirePermission(Permission.CARDS_EXPIRE, locale);
  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({
        where: { id: targetUserId },
        select: sailingCardAuditSelect,
      });
      if (before === null) {
        throw new Error('not_found');
      }
      if (!hasIssuedSailingCard(before)) {
        throw new Error('no_current_card');
      }
      const after = {
        ...before,
        sailingCardExpiresOn: null,
        sailingCardIssuedAt: null,
        sailingCardIssuedByUserId: null,
        sailingCardNumber: null,
        sailingCardRequestedAt: null,
        sailingCardSwimAgreementInitialedAt: null,
        sailingCardSwimAgreementInitials: null,
        sailingCardYear: null,
      };

      await tx.user.update({
        where: { id: targetUserId },
        data: after,
      });
      await createSailingCardAudit({
        after,
        before,
        db: tx,
        targetUserId,
        userId: session.user.id,
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') {
      return {
        fieldErrors: {},
        formError: 'not_found',
        status: 'error',
      };
    }
    if (error instanceof Error && error.message === 'no_current_card') {
      return {
        fieldErrors: {},
        formError: 'no_current_card',
        status: 'error',
      };
    }
    throw error;
  }

  revalidateSailingCardAdminPaths(locale, targetUserId);
  return { fieldErrors: {}, status: 'success' };
}
