import 'server-only';
import type { AdminSailingCardHistoryRow } from '@/components/mit-sailing/admin/cards/AdminSailingCardControls';
import type { Prisma } from '@/generated/prisma/client';
import { LegalAgreementAcceptanceSource } from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';
import {
  sailingCardAgreement,
  sailingCardAgreementHash,
} from '@/libs/mit-sailing/sailingCardAgreement';

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value))
    : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function trimmedValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
}

function historyActorName(
  user: { readonly email: string; readonly name: string } | null
) {
  return trimmedValue(user?.name) ?? trimmedValue(user?.email);
}

function historyAction(props: {
  readonly fromNumber: number | null;
  readonly fromYear: number | null;
  readonly toNumber: number | null;
  readonly toYear: number | null;
}): AdminSailingCardHistoryRow['action'] | null {
  if (
    props.fromNumber === props.toNumber &&
    props.fromYear === props.toYear &&
    [props.fromNumber, props.fromYear].some((value) => value !== null)
  ) {
    return null;
  }
  if (
    props.fromNumber === null &&
    props.fromYear === null &&
    props.toNumber !== null &&
    props.toYear !== null
  ) {
    return 'issued';
  }
  if (
    props.fromNumber !== null &&
    props.fromYear !== null &&
    props.toNumber === null &&
    props.toYear === null
  ) {
    return 'expired';
  }
  if (
    props.fromNumber !== null &&
    props.fromYear !== null &&
    props.toNumber !== null &&
    props.toYear !== null
  ) {
    return 'changed';
  }
  return null;
}

function historyRowFromAudit(row: {
  readonly auditedChanges: Prisma.JsonValue;
  readonly createdAt: Date;
  readonly id: string;
  readonly user: { readonly email: string; readonly name: string } | null;
}): AdminSailingCardHistoryRow | null {
  const changes = objectValue(row.auditedChanges);
  const after = objectValue(changes?.after);
  const before = objectValue(changes?.before);
  const fromNumber = numberValue(before?.sailingCardNumber);
  const fromYear = numberValue(before?.sailingCardYear);
  const toNumber = numberValue(after?.sailingCardNumber);
  const toYear = numberValue(after?.sailingCardYear);
  const action = historyAction({
    fromNumber,
    fromYear,
    toNumber,
    toYear,
  });

  if (action === null) {
    return null;
  }

  return {
    action,
    actorName: historyActorName(row.user),
    createdAt: row.createdAt,
    fromNumber,
    fromYear,
    id: row.id,
    toNumber,
    toYear,
  };
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
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  return rows.flatMap((row) => {
    const historyRow = historyRowFromAudit(row);
    return historyRow === null ? [] : [historyRow];
  });
}

export async function getAdminUserSailingCardSummary(userId: string) {
  const [summary, paymentBypassRequest] = await Promise.all([
    prisma.user.findUnique({
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
          orderBy: [{ cardYear: 'desc' }, { requestedAt: 'desc' }],
          select: {
            cardType: true,
            cardYear: true,
            hasFitnessMembership: true,
            issuedCardNumber: true,
            paymentBypassAt: true,
            paymentBypassBy: {
              select: {
                name: true,
              },
            },
            paymentBypassNote: true,
            requestedAt: true,
            sailingAffiliation: true,
            status: true,
          },
          take: 1,
        },
        sailingCardNumber: true,
        sailingCardRequestedAt: true,
        sailingCardSwimAgreementInitialedAt: true,
        sailingCardSwimAgreementInitials: true,
        sailingCardYear: true,
      },
    }),
    prisma.sailingCardRequest.findFirst({
      where: {
        paymentBypassAt: { not: null },
        userId,
      },
      orderBy: { paymentBypassAt: 'desc' },
      select: {
        cardType: true,
        cardYear: true,
        hasFitnessMembership: true,
        issuedCardNumber: true,
        paymentBypassAt: true,
        paymentBypassBy: {
          select: {
            name: true,
          },
        },
        paymentBypassNote: true,
        requestedAt: true,
        sailingAffiliation: true,
        status: true,
      },
    }),
  ]);
  return summary === null ? null : { ...summary, paymentBypassRequest };
}
