import { describe, expect, it, vi } from 'vitest';
import { UserAuditAction } from '@/generated/prisma/enums';
import {
  ANNUAL_SAILING_CARD_CLEARING_BATCH_SIZE,
  clearAnnualSailingCardState,
} from '@/libs/mit-sailing/sailingCardAnnualClearing';

vi.mock('server-only', () => ({}));

const yearlyCardUser = {
  emergencyContactName: 'Grace Hopper',
  emergencyContactPhone: '+442079460958',
  firstName: 'Ada',
  id: 'user-1',
  lastName: 'Lovelace',
  mitClassYear: '2027',
  mitDataWarehouseVerifiedAt: new Date('2026-05-21T16:00:00.000Z'),
  mitId: '123456789',
  phone: '+16175550100',
  sailingAffiliation: 'MIT_STUDENT',
  sailingCardExpiresOn: new Date('2027-07-15T04:00:00.000Z'),
  sailingCardIssuedAt: new Date('2026-08-01T16:00:00.000Z'),
  sailingCardIssuedByUserId: 'admin-1',
  sailingCardNumber: 61,
  sailingCardRequestedAt: null,
  sailingCardSwimAgreementInitialedAt: new Date('2026-05-21T16:00:00.000Z'),
  sailingCardSwimAgreementInitials: 'AK',
  sailingCardYear: 2027,
};

type AnnualClearingDb = NonNullable<
  Parameters<typeof clearAnnualSailingCardState>[0]['db']
>;

describe('clearAnnualSailingCardState', () => {
  it('clears yearly card state and preserves stable profile fields', async () => {
    const userFindMany = vi.fn().mockResolvedValue([yearlyCardUser]);
    const userUpdate = vi.fn().mockResolvedValue({});
    const userAuditFindFirst = vi.fn().mockResolvedValue({ version: 2 });
    const userAuditCreate = vi.fn().mockResolvedValue({});
    const transaction: AnnualClearingDb['$transaction'] = async (operation) => {
      const result = await operation({
        user: { update: userUpdate },
        userAudit: {
          create: userAuditCreate,
          findFirst: userAuditFindFirst,
        },
      });
      return result;
    };

    await expect(
      clearAnnualSailingCardState({
        db: {
          $transaction: transaction,
          user: { findMany: userFindMany },
        },
        now: new Date('2026-07-15T04:00:00.000Z'),
      })
    ).resolves.toEqual({ cleared: 1 });

    expect(userUpdate).toHaveBeenCalledWith({
      data: {
        sailingCardExpiresOn: null,
        sailingCardIssuedAt: null,
        sailingCardIssuedByUserId: null,
        sailingCardNumber: null,
        sailingCardRequestedAt: null,
        sailingCardSwimAgreementInitialedAt: null,
        sailingCardSwimAgreementInitials: null,
        sailingCardYear: null,
      },
      where: { id: 'user-1' },
    });
    expect(userUpdate.mock.calls[0]?.[0].data).not.toHaveProperty('firstName');
    expect(userUpdate.mock.calls[0]?.[0].data).not.toHaveProperty('phone');
    expect(userUpdate.mock.calls[0]?.[0].data).not.toHaveProperty(
      'emergencyContactName'
    );
    expect(userAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: UserAuditAction.update,
        auditableId: 'user-1',
        auditableType: 'user',
        auditedChanges: expect.objectContaining({
          after: expect.objectContaining({ sailingCardNumber: null }),
          before: expect.objectContaining({ sailingCardNumber: 61 }),
        }),
        userId: null,
        version: 3,
      }),
    });
  });

  it('clears users in bounded transactions', async () => {
    const users = Array.from(
      { length: ANNUAL_SAILING_CARD_CLEARING_BATCH_SIZE + 1 },
      (_value, index) => ({
        ...yearlyCardUser,
        id: `user-${index}`,
      })
    );
    const userFindMany = vi.fn().mockResolvedValue(users);
    let transactionCount = 0;
    const transaction: AnnualClearingDb['$transaction'] = async (operation) => {
      transactionCount += 1;
      const result = await operation({
        user: { update: vi.fn().mockResolvedValue({}) },
        userAudit: {
          create: vi.fn().mockResolvedValue({}),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      });
      return result;
    };

    await expect(
      clearAnnualSailingCardState({
        db: {
          $transaction: transaction,
          user: { findMany: userFindMany },
        },
        now: new Date('2026-07-15T04:00:00.000Z'),
      })
    ).resolves.toEqual({ cleared: users.length });

    expect(transactionCount).toBe(2);
  });

  it('does nothing before july 15 eastern', async () => {
    const userFindMany = vi.fn();

    await expect(
      clearAnnualSailingCardState({
        db: {
          $transaction: vi.fn(),
          user: { findMany: userFindMany },
        },
        now: new Date('2026-07-15T03:59:00.000Z'),
      })
    ).resolves.toEqual({ cleared: 0 });

    expect(userFindMany).not.toHaveBeenCalled();
  });

  it('does nothing after july 15 eastern', async () => {
    const userFindMany = vi.fn();

    await expect(
      clearAnnualSailingCardState({
        db: {
          $transaction: vi.fn(),
          user: { findMany: userFindMany },
        },
        now: new Date('2026-07-16T04:00:00.000Z'),
      })
    ).resolves.toEqual({ cleared: 0 });

    expect(userFindMany).not.toHaveBeenCalled();
  });
});
