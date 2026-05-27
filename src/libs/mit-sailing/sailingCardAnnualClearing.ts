import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { UserAuditAction } from '@/generated/prisma/enums';
import { nyYmd } from '@/lib/mit-sailing/nyTime';
import { prisma } from '@/libs/DB';

type AnnualClearingTx = {
  readonly user: {
    readonly update: (args: Prisma.UserUpdateArgs) => Promise<unknown>;
  };
  readonly userAudit: {
    readonly create: (args: Prisma.UserAuditCreateArgs) => Promise<unknown>;
    readonly findFirst: (
      args: Prisma.UserAuditFindFirstArgs
    ) => Promise<{ version: number } | null>;
  };
};

type AnnualClearingDb = {
  readonly $transaction: <T>(
    callback: (tx: AnnualClearingTx) => Promise<T>
  ) => Promise<T>;
  readonly user: {
    readonly findMany: (args: {
      readonly select: typeof annualClearingSelect;
      readonly where: Prisma.UserWhereInput;
    }) => Promise<AnnualClearingUser[]>;
  };
};

type AnnualClearingUser = {
  readonly id: string;
  readonly sailingCardExpiresOn: Date | null;
  readonly sailingCardIssuedAt: Date | null;
  readonly sailingCardIssuedByUserId: string | null;
  readonly sailingCardNumber: number | null;
  readonly sailingCardRequestedAt: Date | null;
  readonly sailingCardSwimAgreementInitialedAt: Date | null;
  readonly sailingCardSwimAgreementInitials: string | null;
  readonly sailingCardYear: number | null;
};

const annualClearingSelect = {
  id: true,
  sailingCardExpiresOn: true,
  sailingCardIssuedAt: true,
  sailingCardIssuedByUserId: true,
  sailingCardNumber: true,
  sailingCardRequestedAt: true,
  sailingCardSwimAgreementInitialedAt: true,
  sailingCardSwimAgreementInitials: true,
  sailingCardYear: true,
} as const;

const clearedAnnualSailingCardState = {
  sailingCardExpiresOn: null,
  sailingCardIssuedAt: null,
  sailingCardIssuedByUserId: null,
  sailingCardNumber: null,
  sailingCardRequestedAt: null,
  sailingCardSwimAgreementInitialedAt: null,
  sailingCardSwimAgreementInitials: null,
  sailingCardYear: null,
} as const;

export const ANNUAL_SAILING_CARD_CLEARING_BATCH_SIZE = 100;

function jsonDate(date: Date | null) {
  return date?.toISOString() ?? null;
}

function annualAuditValue(user: AnnualClearingUser) {
  return {
    sailingCardExpiresOn: jsonDate(user.sailingCardExpiresOn),
    sailingCardIssuedAt: jsonDate(user.sailingCardIssuedAt),
    sailingCardIssuedByUserId: user.sailingCardIssuedByUserId,
    sailingCardNumber: user.sailingCardNumber,
    sailingCardRequestedAt: jsonDate(user.sailingCardRequestedAt),
    sailingCardSwimAgreementInitialedAt: jsonDate(
      user.sailingCardSwimAgreementInitialedAt
    ),
    sailingCardSwimAgreementInitials: user.sailingCardSwimAgreementInitials,
    sailingCardYear: user.sailingCardYear,
  };
}

function isJulyFifteenthEasternStart(now: Date) {
  return nyYmd(now).endsWith('-07-15');
}

const defaultAnnualClearingDb: AnnualClearingDb = {
  $transaction: async <T>(operation: (tx: AnnualClearingTx) => Promise<T>) => {
    const result = await prisma.$transaction(async (tx) => {
      const operationResult = await operation(tx);
      return operationResult;
    });
    return result;
  },
  user: {
    findMany: async (args) => {
      const users = await prisma.user.findMany(args);
      return users;
    },
  },
};

function annualClearingBatches(users: AnnualClearingUser[]) {
  const batches: AnnualClearingUser[][] = [];
  for (
    let index = 0;
    index < users.length;
    index += ANNUAL_SAILING_CARD_CLEARING_BATCH_SIZE
  ) {
    batches.push(
      users.slice(index, index + ANNUAL_SAILING_CARD_CLEARING_BATCH_SIZE)
    );
  }
  return batches;
}

async function clearAnnualSailingCardBatch(
  db: AnnualClearingDb,
  users: AnnualClearingUser[]
) {
  await db.$transaction(async (tx) => {
    for (const user of users) {
      const latestAudit = await tx.userAudit.findFirst({
        orderBy: { version: 'desc' },
        select: { version: true },
        where: {
          auditableId: user.id,
          auditableType: 'user',
        },
      });
      await tx.user.update({
        data: clearedAnnualSailingCardState,
        where: { id: user.id },
      });
      await tx.userAudit.create({
        data: {
          action: UserAuditAction.update,
          auditableId: user.id,
          auditableType: 'user',
          auditedChanges: {
            after: annualAuditValue({
              ...user,
              ...clearedAnnualSailingCardState,
            }),
            before: annualAuditValue(user),
          },
          userId: null,
          version: (latestAudit?.version ?? 0) + 1,
        },
      });
    }
  });
}

export async function clearAnnualSailingCardState(props: {
  readonly db?: AnnualClearingDb;
  readonly now?: Date;
}) {
  const now = props.now ?? new Date();
  if (!isJulyFifteenthEasternStart(now)) {
    return { cleared: 0 };
  }
  const db = props.db ?? defaultAnnualClearingDb;
  const users = await db.user.findMany({
    where: {
      OR: [
        { sailingCardNumber: { not: null } },
        { sailingCardYear: { not: null } },
        { sailingCardExpiresOn: { not: null } },
        { sailingCardRequestedAt: { not: null } },
        { sailingCardIssuedAt: { not: null } },
        { sailingCardIssuedByUserId: { not: null } },
        { sailingCardSwimAgreementInitials: { not: null } },
        { sailingCardSwimAgreementInitialedAt: { not: null } },
      ],
    },
    select: annualClearingSelect,
  });

  for (const batch of annualClearingBatches(users)) {
    await clearAnnualSailingCardBatch(db, batch);
  }

  return { cleared: users.length };
}
