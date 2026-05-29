import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PaymentPurpose,
  PaymentSource,
  PaymentStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import {
  buildLegacyMemberPaymentMap,
  importLegacyPaymentRows,
  legacyPaymentAmountCents,
  legacyPaymentPurpose,
  legacyPaymentStatus,
  legacyPaymentUserId,
} from '@/libs/legacy-sync/legacyPaymentImport';
import type {
  LegacyMemberRow,
  LegacyPaymentRow,
} from '@/libs/legacy-sync/legacyPaymentImport';

const mocks = vi.hoisted(() => ({
  paymentUpsert: vi.fn(),
  transaction: vi.fn(),
  userCreate: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
}));

type MockLegacyPaymentImportDb = {
  readonly payment: {
    readonly upsert: typeof mocks.paymentUpsert;
  };
  readonly user: {
    readonly create: typeof mocks.userCreate;
    readonly findUnique: typeof mocks.userFindUnique;
    readonly update: typeof mocks.userUpdate;
  };
};

type MockTransactionOperation = (
  tx: MockLegacyPaymentImportDb
) => Promise<unknown>;

vi.mock('@/libs/DB', () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

function member(overrides: Partial<LegacyMemberRow> = {}): LegacyMemberRow {
  return {
    active: '1',
    card: '',
    email: 'sailor@example.com',
    emer_email: '',
    emer_name: '',
    emer_phone: '',
    expire_date: '',
    first: 'Sailor',
    id: '123456789',
    last: 'One',
    memb_type: '1',
    phone: '',
    record: '1',
    record_date: '2026-01-01 12:00:00',
    status_type: '2',
    username: 'sailor',
    ...overrides,
  };
}

function payment(overrides: Partial<LegacyPaymentRow> = {}): LegacyPaymentRow {
  return {
    amount: '120.00',
    billTo_email: 'sailor@example.com',
    billTo_firstName: 'Sailor',
    billTo_lastName: 'One',
    category: 'Racing',
    date: '2026-05-01',
    description: 'Racing Card 2026-2027 for sailor',
    last4: '4242',
    omarsid: '1001',
    settled: '1',
    userid: '123456789',
    ...overrides,
  };
}

describe('legacyPaymentImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userCreate.mockImplementation(
      async (props: { data: { id: string } }) => {
        const created = await Promise.resolve({
          id: props.data.id,
        });
        return created;
      }
    );
    mocks.userUpdate.mockResolvedValue({});
    mocks.paymentUpsert.mockResolvedValue({});
    mocks.transaction.mockImplementation(
      async (operation: MockTransactionOperation) => {
        const result = await operation({
          payment: { upsert: mocks.paymentUpsert },
          user: {
            create: mocks.userCreate,
            findUnique: mocks.userFindUnique,
            update: mocks.userUpdate,
          },
        });
        return result;
      }
    );
  });

  it('maps active duplicate legacy emails to one canonical app user', () => {
    const map = buildLegacyMemberPaymentMap([
      member({ id: '123456789', username: 'sailor' }),
      member({
        card: '44',
        email: ' SAILOR@example.com ',
        expire_date: '2026-07-15',
        first: 'Other',
        id: 'AUTO0001',
        record_date: '2026-03-01 09:00:00',
        username: 'old-sailor',
      }),
      member({
        active: '0',
        email: 'inactive@example.com',
        id: '999999999',
        username: 'inactive',
      }),
    ]);

    expect(map.canonicalUsers).toHaveLength(1);
    expect(map.memberUserKeyByLegacyId.get('123456789')).toBe(
      map.memberUserKeyByLegacyId.get('AUTO0001')
    );
    expect(map.memberUserKeyByUsername.get('old-sailor')).toBe(
      map.memberUserKeyByLegacyId.get('123456789')
    );
    expect(map.memberUserKeyByLegacyId.has('999999999')).toBe(false);
  });

  it('classifies canonical racing card rows as membership payments', () => {
    expect(legacyPaymentPurpose(payment())).toEqual({
      cardType: SailingCardType.racing,
      cardYear: 2027,
      purpose: PaymentPurpose.membership,
    });
  });

  it('keeps unsettled racing payments out of paid access', () => {
    expect(legacyPaymentStatus(payment({ settled: '0' }))).toBe(
      PaymentStatus.needs_review
    );
  });

  it('keeps old deposit authorizations out of paid access', () => {
    expect(
      legacyPaymentStatus(
        payment({
          category: null,
          description: 'CROTR07 Damage Deposit - Team 2 Boat 3',
          omarsid: 'BD-135670323',
          settled: '0',
        })
      )
    ).toBe(PaymentStatus.needs_review);
  });

  it('parses legacy decimal dollar amounts into cents', () => {
    expect(legacyPaymentAmountCents('120.50')).toBe(12_050);
  });

  it('matches payment users by legacy id username or billing email', () => {
    const map = buildLegacyMemberPaymentMap([
      member({
        email: 'sailor@example.com',
        id: '123456789',
        username: 'sailor',
      }),
    ]);
    const [canonical] = map.canonicalUsers;
    expect(canonical).toBeDefined();
    if (!canonical) {
      return;
    }

    expect(
      legacyPaymentUserId({
        appUserIdByKey: new Map([[canonical.key, 'app-user-1']]),
        map,
        payment: payment({ userid: '123456789' }),
      })
    ).toBe('app-user-1');
    expect(
      legacyPaymentUserId({
        appUserIdByKey: new Map([[canonical.key, 'app-user-1']]),
        map,
        payment: payment({
          description: 'Racing Card 2026-2027 for sailor',
          userid: '',
        }),
      })
    ).toBe('app-user-1');
    expect(
      legacyPaymentUserId({
        appUserIdByKey: new Map([[canonical.key, 'app-user-1']]),
        map,
        payment: payment({
          billTo_email: 'sailor@example.com',
          description: '',
          userid: '',
        }),
      })
    ).toBe('app-user-1');
  });

  it('imports legacy users and payments without storing legacy usernames', async () => {
    await expect(
      importLegacyPaymentRows({
        members: [
          member({ id: '123456789', username: 'sailor' }),
          member({
            card: '110',
            email: 'sailor@example.com',
            expire_date: '2027-07-15',
            id: 'AUTO0001',
            record_date: '2026-06-01 12:00:00',
            username: 'old-sailor',
          }),
        ],
        payments: [payment()],
      })
    ).resolves.toEqual({
      cardRecordsMerged: 1,
      paymentsImported: 1,
      paymentsNeedingReview: 0,
      usersCreated: 1,
      usersMatched: 0,
    });

    expect(mocks.userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          legacyUsername: expect.anything(),
          username: expect.anything(),
        }),
      })
    );
    expect(mocks.userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sailingCardExpiresOn: new Date('2027-07-15T12:00:00.000Z'),
          sailingCardIssuedAt: new Date('2026-06-01T12:00:00.000Z'),
          sailingCardNumber: 110,
          sailingCardYear: 2027,
        }),
      })
    );
    expect(mocks.paymentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          cardType: SailingCardType.racing,
          cardYear: 2027,
          legacyCategory: 'Racing',
          legacyDescription: 'Racing Card 2026-2027 for sailor',
          legacySettled: true,
          legacySourceId: '1001',
          legacySourceTable: 'payments',
          purpose: PaymentPurpose.membership,
          source: PaymentSource.legacy,
          status: PaymentStatus.paid,
          userId: expect.any(String),
        }),
        where: {
          legacySourceTable_legacySourceId: {
            legacySourceId: '1001',
            legacySourceTable: 'payments',
          },
        },
      })
    );
  });

  it('merges legacy card data onto matched existing users without overwriting assigned cards', async () => {
    mocks.userFindUnique
      .mockResolvedValueOnce({
        id: 'existing-user-1',
        sailingCardNumber: null,
        sailingCardYear: null,
      })
      .mockResolvedValueOnce({
        id: 'existing-user-2',
        sailingCardNumber: 72,
        sailingCardYear: 2027,
      });

    await expect(
      importLegacyPaymentRows({
        members: [
          member({
            card: '110',
            email: 'sailor@example.com',
            expire_date: '2027-07-15',
          }),
          member({
            card: '111',
            email: 'assigned@example.com',
            expire_date: '2027-07-15',
            id: '987654321',
            username: 'assigned',
          }),
        ],
        payments: [],
      })
    ).resolves.toEqual({
      cardRecordsMerged: 1,
      paymentsImported: 0,
      paymentsNeedingReview: 0,
      usersCreated: 0,
      usersMatched: 2,
    });

    expect(mocks.userUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      data: {
        sailingCardExpiresOn: new Date('2027-07-15T12:00:00.000Z'),
        sailingCardIssuedAt: new Date('2026-01-01T12:00:00.000Z'),
        sailingCardNumber: 110,
        sailingCardYear: 2027,
      },
      where: { id: 'existing-user-1' },
    });
  });

  it('imports unmatched legacy rows for admin review', async () => {
    await expect(
      importLegacyPaymentRows({
        members: [],
        payments: [
          payment({
            billTo_email: '',
            category: 'Regatta',
            description: 'Legacy regatta payment',
            userid: '',
          }),
        ],
      })
    ).resolves.toMatchObject({
      cardRecordsMerged: 0,
      paymentsImported: 1,
      paymentsNeedingReview: 1,
    });

    expect(mocks.paymentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          legacyCategory: 'Regatta',
          legacyDescription: 'Legacy regatta payment',
          purpose: PaymentPurpose.event_payment,
          status: PaymentStatus.needs_review,
          userId: null,
        }),
      })
    );
  });

  it('keeps unmatched racing card rows reviewable as membership context', async () => {
    await importLegacyPaymentRows({
      members: [],
      payments: [
        payment({
          billTo_email: '',
          description: 'Racing Card 2026-2027 for unknown-sailor',
          settled: '0',
          userid: '',
        }),
      ],
    });

    expect(mocks.paymentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          cardType: SailingCardType.racing,
          cardYear: 2027,
          purpose: PaymentPurpose.membership,
          status: PaymentStatus.needs_review,
          userId: null,
        }),
      })
    );
  });
});
