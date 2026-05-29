import 'server-only';
import type {
  AdminSailingCardHistoryRow,
  AdminSailingCardQueueRow,
} from '@/components/mit-sailing/admin/cards/AdminSailingCardQueue';
import type { Prisma } from '@/generated/prisma/client';
import {
  LegalAgreementAcceptanceSource,
  PaymentPurpose,
  PaymentStatus,
  SailingCardRequestStatus,
} from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';
import { membershipPaymentAccessStatus } from '@/libs/mit-sailing/membershipBilling/membershipPaymentStatus';
import {
  sailingCardAgreement,
  sailingCardAgreementHash,
} from '@/libs/mit-sailing/sailingCardAgreement';
import { getCurrentSailingCardYear } from '@/libs/mit-sailing/sailingCardValidity';

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value))
    : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function historyRowFromAudit(row: {
  readonly auditedChanges: Prisma.JsonValue;
  readonly createdAt: Date;
  readonly id: string;
}): AdminSailingCardHistoryRow | null {
  const changes = objectValue(row.auditedChanges);
  const after = objectValue(changes?.after);
  const before = objectValue(changes?.before);
  const number =
    numberValue(before?.sailingCardNumber) ??
    numberValue(after?.sailingCardNumber);
  const year =
    numberValue(before?.sailingCardYear) ?? numberValue(after?.sailingCardYear);

  if (number === null || year === null) {
    return null;
  }

  return {
    createdAt: row.createdAt,
    id: row.id,
    number,
    year,
  };
}

function paymentAccessPriority(
  access: AdminSailingCardQueueRow['paymentAccess']
) {
  if (access === 'paid') {
    return 3;
  }
  if (access === 'blocked') {
    return 2;
  }
  return 1;
}

export async function listPendingSailingCardRequests(): Promise<
  AdminSailingCardQueueRow[]
> {
  const cardYear = getCurrentSailingCardYear();
  const rows = await prisma.sailingCardRequest.findMany({
    where: {
      cardYear,
      status: SailingCardRequestStatus.pending,
    },
    orderBy: { requestedAt: 'asc' },
    select: {
      cardType: true,
      hasFitnessMembership: true,
      id: true,
      legalAgreementAcceptance: {
        select: {
          acceptedAt: true,
          agreementVersion: true,
        },
      },
      firstName: true,
      lastName: true,
      mitId: true,
      requestedAt: true,
      sailingAffiliation: true,
      user: {
        select: {
          email: true,
          id: true,
        },
      },
    },
  });
  const userIds = rows.map((row) => row.user.id);
  const payments =
    userIds.length === 0
      ? []
      : await prisma.payment.findMany({
          where: {
            cardYear,
            purpose: PaymentPurpose.membership,
            userId: { in: userIds },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            cardType: true,
            source: true,
            status: true,
            stripeReceiptUrl: true,
            userId: true,
          },
        });
  const accessByKey = new Map<
    string,
    AdminSailingCardQueueRow['paymentAccess']
  >();
  for (const payment of payments) {
    if (payment.cardType !== 'racing' && payment.cardType !== 'team_racing') {
      continue;
    }
    const key = `${payment.userId}:${payment.cardType}`;
    const access = membershipPaymentAccessStatus({
      cardYear,
      record: {
        cardType: payment.cardType,
        cardYear,
        source: payment.source,
        status:
          payment.status === PaymentStatus.checkout_created
            ? PaymentStatus.pending
            : payment.status,
        stripeReceiptUrl: payment.stripeReceiptUrl,
      },
    });
    const currentAccess = accessByKey.get(key);
    if (
      currentAccess === undefined ||
      paymentAccessPriority(access.access) >
        paymentAccessPriority(currentAccess)
    ) {
      accessByKey.set(key, access.access);
    }
  }

  return rows.map((row) => ({
    agreementAcceptedAt: row.legalAgreementAcceptance.acceptedAt,
    agreementVersion: row.legalAgreementAcceptance.agreementVersion,
    cardType: row.cardType,
    email: row.user.email,
    hasFitnessMembership: row.hasFitnessMembership,
    id: row.user.id,
    mitId: row.mitId,
    name: `${row.firstName} ${row.lastName}`,
    paymentAccess: accessByKey.get(`${row.user.id}:${row.cardType}`) ?? 'none',
    requestedAt: row.requestedAt,
    sailingAffiliation: row.sailingAffiliation,
  }));
}

export async function getAdminSailingCardHistory(
  userId: string
): Promise<AdminSailingCardHistoryRow[]> {
  const rows = await prisma.userAudit.findMany({
    where: {
      auditableId: userId,
      auditableType: 'user',
    },
    orderBy: { createdAt: 'desc' },
    select: {
      auditedChanges: true,
      createdAt: true,
      id: true,
    },
  });

  return rows.flatMap((row) => {
    const historyRow = historyRowFromAudit(row);
    return historyRow === null ? [] : [historyRow];
  });
}

export async function getAdminUserSailingCardSummary(userId: string) {
  const summary = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      sailingCardExpiresOn: true,
      sailingCardIssuedAt: true,
      sailingCardIssuedBy: {
        select: {
          name: true,
        },
      },
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
      sailingCardRequests: {
        orderBy: { paymentBypassAt: 'desc' },
        select: {
          paymentBypassAt: true,
          paymentBypassBy: {
            select: {
              name: true,
            },
          },
          paymentBypassNote: true,
        },
        where: { paymentBypassAt: { not: null } },
        take: 1,
      },
      sailingCardNumber: true,
      sailingCardRequestedAt: true,
      sailingCardSwimAgreementInitialedAt: true,
      sailingCardSwimAgreementInitials: true,
      sailingCardYear: true,
    },
  });
  return summary;
}
