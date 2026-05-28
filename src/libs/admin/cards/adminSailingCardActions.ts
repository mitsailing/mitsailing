'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import {
  LegalAgreementAcceptanceSource,
  SailingCardRequestStatus,
  UserAuditAction,
} from '@/generated/prisma/enums';
import { getNextAvailableSailingCardNumber } from '@/libs/admin/cards/adminSailingCardQueries';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import { prisma } from '@/libs/DB';
import {
  sailingCardAgreement,
  sailingCardAgreementHash,
} from '@/libs/mit-sailing/sailingCardAgreement';
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
  | 'no_current_card'
  | 'not_pending_request'
  | 'not_found';

export type AdminSailingCardActionState = {
  readonly fieldErrors: AdminSailingCardFieldErrors;
  readonly formError?: AdminSailingCardFormError;
  readonly status: 'error' | 'idle' | 'success';
};

type AdminSailingCardDb = Pick<Prisma.TransactionClient, 'user' | 'userAudit'>;
type AdminSailingCardIssueDb = Pick<
  Prisma.TransactionClient,
  'sailingCardRequest' | 'user' | 'userAudit'
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
      id: true,
      legalAgreementAcceptance: {
        select: {
          agreementHash: true,
          agreementVersion: true,
          source: true,
          userId: true,
        },
      },
    },
  });
  return request;
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
      target.includes('sailingCardYear') && target.includes('sailingCardNumber')
    );
  }
  return (
    typeof target === 'string' &&
    (target.includes('sailingCardYear_sailingCardNumber') ||
      target.includes('sailing_card_year_sailing_card_number'))
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
  revalidatePath(getI18nPath('/admin/cards', locale));
  revalidatePath(
    getI18nPath(`/admin/users/${encodeURIComponent(userId)}`, locale)
  );
  revalidatePath(getI18nPath('/onboarding', locale));
  revalidatePath(getI18nPath('/profile/account', locale));
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
      if (
        request.legalAgreementAcceptance.agreementHash !==
          sailingCardAgreementHash() ||
        request.legalAgreementAcceptance.agreementVersion !==
          sailingCardAgreement.version ||
        request.legalAgreementAcceptance.source !==
          LegalAgreementAcceptanceSource.SAILING_CARD_ONBOARDING ||
        request.legalAgreementAcceptance.userId !== targetUserId
      ) {
        throw new Error('missing_onboarding_agreement');
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
    if (isSailingCardUniqueError(error)) {
      return {
        fieldErrors: { cardNumber: 'duplicate' },
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
    if (
      error instanceof Error &&
      error.message === 'missing_onboarding_agreement'
    ) {
      return {
        fieldErrors: {},
        formError: 'missing_onboarding_agreement',
        status: 'error',
      };
    }
    if (error instanceof Error && error.message === 'not_pending_request') {
      return {
        fieldErrors: {},
        formError: 'not_pending_request',
        status: 'error',
      };
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
