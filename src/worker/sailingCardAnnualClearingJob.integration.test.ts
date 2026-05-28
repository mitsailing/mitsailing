import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@/generated/prisma/client';

type AnnualClearingUserMock = {
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

type AnnualClearingTxMock = {
  readonly user: {
    readonly update: (args: Prisma.UserUpdateArgs) => unknown;
  };
  readonly userAudit: {
    readonly create: (args: Prisma.UserAuditCreateArgs) => unknown;
    readonly findFirst: (
      args: Prisma.UserAuditFindFirstArgs
    ) => { version: number } | null;
  };
};

type AnnualClearingOperation = (tx: AnnualClearingTxMock) => Promise<unknown>;

const mocks = vi.hoisted(() => {
  const state = {
    transactionBatchSizes: [] as number[],
    users: [] as AnnualClearingUserMock[],
  };

  return {
    logger: {
      error: vi.fn(),
      info: vi.fn(),
    },
    transactionBatchSizes: state.transactionBatchSizes,
    users: state.users,
    prismaTransaction: vi.fn(async (operation: AnnualClearingOperation) => {
      let updateCount = 0;
      const result = await operation({
        user: {
          update: () => {
            updateCount += 1;
            return {};
          },
        },
        userAudit: {
          create: () => ({}),
          findFirst: () => null,
        },
      });
      state.transactionBatchSizes.push(updateCount);
      return result;
    }),
    userFindMany: vi.fn(() => state.users),
  };
});

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    $transaction: mocks.prismaTransaction,
    user: {
      findMany: mocks.userFindMany,
    },
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: mocks.logger,
}));

function annualCardUser(id: string): AnnualClearingUserMock {
  return {
    id,
    sailingCardExpiresOn: new Date('2027-07-15T04:00:00.000Z'),
    sailingCardIssuedAt: new Date('2026-08-01T16:00:00.000Z'),
    sailingCardIssuedByUserId: 'admin-1',
    sailingCardNumber: 61,
    sailingCardRequestedAt: null,
    sailingCardSwimAgreementInitialedAt: new Date('2026-05-21T16:00:00.000Z'),
    sailingCardSwimAgreementInitials: 'AK',
    sailingCardYear: 2027,
  };
}

describe('processSailingCardAnnualClearingJob integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transactionBatchSizes.length = 0;
    mocks.users.length = 0;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T04:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs clearing through bounded transaction batches', async () => {
    const { ANNUAL_SAILING_CARD_CLEARING_BATCH_SIZE } =
      await import('@/libs/mit-sailing/sailingCardAnnualClearing');
    mocks.users.push(
      ...Array.from(
        { length: ANNUAL_SAILING_CARD_CLEARING_BATCH_SIZE + 1 },
        (_value, index) => annualCardUser(`user-${index}`)
      )
    );
    const { processSailingCardAnnualClearingJob } =
      await import('@/worker/sailingCardAnnualClearingJob');

    await processSailingCardAnnualClearingJob();

    expect(mocks.userFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.prismaTransaction).toHaveBeenCalledTimes(2);
    expect(mocks.transactionBatchSizes).toEqual([
      ANNUAL_SAILING_CARD_CLEARING_BATCH_SIZE,
      1,
    ]);
    expect(mocks.logger.info).toHaveBeenCalledWith(
      '[sailing-card-annual-clearing] cleared={cleared}',
      { cleared: ANNUAL_SAILING_CARD_CLEARING_BATCH_SIZE + 1 }
    );
  });
});
