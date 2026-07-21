import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PaymentPurpose,
  PaymentSource,
  PaymentStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import { buildLegacyMemberPaymentMap } from '@/libs/legacy-sync/legacyMemberIdentity';
import type { LegacyMemberRow } from '@/libs/legacy-sync/legacyMemberIdentity';
import {
  importLegacyPaymentRows,
  legacyPaymentAmountCents,
  legacyPaymentPurpose,
  legacyPaymentStatus,
  legacyPaymentUserId,
} from '@/libs/legacy-sync/legacyPaymentImport';
import type { LegacyPaymentRow } from '@/libs/legacy-sync/legacyPaymentImport';

const mocks = vi.hoisted(() => ({
  executeRaw: vi.fn(),
  paymentCreateMany: vi.fn(),
  paymentFindMany: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
}));

type MockLegacyPaymentImportDb = {
  readonly payment: {
    readonly createMany: typeof mocks.paymentCreateMany;
    readonly findMany: typeof mocks.paymentFindMany;
  };
  readonly $executeRaw: typeof mocks.executeRaw;
  readonly $queryRaw: typeof mocks.queryRaw;
};

type MockTransactionOperation = (
  tx: MockLegacyPaymentImportDb
) => Promise<unknown>;

vi.mock('@/libs/DB', () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

function rawSqlText(query: unknown): string {
  if (Array.isArray(query)) {
    return query.join('');
  }
  if (typeof query === 'object' && query !== null && 'strings' in query) {
    const candidate = query as { strings?: unknown };
    if (Array.isArray(candidate.strings)) {
      return candidate.strings.join('');
    }
  }
  if (
    typeof query === 'string' ||
    typeof query === 'number' ||
    typeof query === 'boolean'
  ) {
    return String(query);
  }
  return '';
}

function allRawSqlCalls(): string[] {
  return [
    ...mocks.executeRaw.mock.calls.map((call) => rawSqlText(call[0])),
    ...mocks.queryRaw.mock.calls.map((call) => rawSqlText(call[0])),
  ];
}

function expectAnyRawSqlContaining(expected: readonly string[]) {
  const queries = allRawSqlCalls();
  expect(
    queries.some((query) =>
      expected.every((fragment) => query.includes(fragment))
    )
  ).toBe(true);
}

function mockLegacyUserSqlSequence(props?: {
  existing?: readonly { id: string; user_key: string }[];
  inserted?: readonly {
    id: string;
    sailing_card_number: number | null;
    user_key: string;
  }[];
  merged?: readonly { id: string }[];
  namesUpdated?: readonly { id: string }[];
  staged?: readonly { id: string; user_key: string }[];
}) {
  mocks.queryRaw.mockReset();
  mocks.queryRaw
    .mockResolvedValueOnce(props?.existing ?? [])
    .mockResolvedValueOnce(props?.merged ?? [])
    .mockResolvedValueOnce(props?.namesUpdated ?? [])
    .mockResolvedValueOnce(
      props?.inserted ?? [
        {
          id: 'imported-user-1',
          sailing_card_number: null,
          user_key: 'id:123456789',
        },
      ]
    )
    .mockResolvedValueOnce(
      props?.staged ?? [
        { id: 'imported-user-1', user_key: 'id:123456789' },
        { id: 'imported-user-1', user_key: 'id:AUTO0001' },
        { id: 'imported-user-1', user_key: 'email:sailor@example.com' },
      ]
    );
}

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
    mockLegacyUserSqlSequence();
    mocks.paymentFindMany.mockResolvedValue([]);
    mocks.paymentCreateMany.mockResolvedValue({ count: 0 });
    mocks.executeRaw.mockResolvedValue(0);
    mocks.transaction.mockImplementation(
      async (operation: MockTransactionOperation) => {
        const result = await operation({
          $executeRaw: mocks.executeRaw,
          $queryRaw: mocks.queryRaw,
          payment: {
            createMany: mocks.paymentCreateMany,
            findMany: mocks.paymentFindMany,
          },
        });
        return result;
      }
    );
  });

  it('normalizes legacy contact phones before staging users', () => {
    const map = buildLegacyMemberPaymentMap([
      member({
        emer_name: 'Emergency Person',
        emer_phone: '+44 20 7946 0958',
        phone: '(617) 555-0100',
      }),
    ]);

    expect(map.canonicalUsers.at(0)).toMatchObject({
      emergencyContactName: 'Emergency Person',
      emergencyContactPhone: '+442079460958',
      phone: '+16175550100',
    });
  });

  it('name-cases legacy member names before staging users', () => {
    const map = buildLegacyMemberPaymentMap([
      member({
        first: 'YOONSEO',
        last: "O'NEIL-CHA",
      }),
    ]);

    expect(map.canonicalUsers.at(0)).toMatchObject({
      firstName: 'Yoonseo',
      lastName: "O'Neil-Cha",
      name: "Yoonseo O'Neil-Cha",
    });
  });

  it('drops invalid optional legacy contact phones', () => {
    const map = buildLegacyMemberPaymentMap([
      member({
        emer_name: 'Emergency Person',
        emer_phone: '555',
        phone: '+44 20 7946 0958',
      }),
    ]);

    expect(map.canonicalUsers.at(0)).toMatchObject({
      emergencyContactName: null,
      emergencyContactPhone: null,
      phone: null,
    });
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

  it('classifies old deposit authorizations as not paid if inspected directly', () => {
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

  it('skips old deposit authorizations during nightly import', async () => {
    await expect(
      importLegacyPaymentRows({
        members: [],
        payments: [
          payment({
            category: null,
            description: 'CROTR07 Damage Deposit - Team 2 Boat 3',
            omarsid: 'BD-135670323',
            settled: '0',
          }),
        ],
      })
    ).resolves.toMatchObject({
      cardRecordsMerged: 0,
      namesUpdated: 0,
      paymentsImported: 0,
      paymentsNeedingReview: 0,
    });

    expect(mocks.paymentCreateMany).not.toHaveBeenCalled();
  });

  it('parses legacy decimal dollar amounts into cents', () => {
    expect(legacyPaymentAmountCents('120.50')).toBe(12_050);
  });

  it('parses legacy currency amount strings into cents', () => {
    expect(legacyPaymentAmountCents('$1,200.50')).toBe(120_050);
  });

  it('does not turn negative legacy adjustments into positive payments', () => {
    expect(legacyPaymentAmountCents('-$12.00')).toBe(0);
    expect(legacyPaymentAmountCents('USD -12.00')).toBe(0);
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

  it('name-cases legacy payment payer names', async () => {
    mockLegacyUserSqlSequence({
      staged: [{ id: 'imported-user-1', user_key: 'id:123456789' }],
    });

    await importLegacyPaymentRows({
      members: [member()],
      payments: [
        payment({
          billTo_firstName: 'YOONSEO',
          billTo_lastName: "O'NEIL-CHA",
        }),
      ],
    });

    expect(mocks.paymentCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            payerName: "Yoonseo O'Neil-Cha",
          }),
        ]),
      })
    );
  });

  it('updates all-caps matched user names during import', async () => {
    mockLegacyUserSqlSequence({
      existing: [{ id: 'existing-user', user_key: 'id:123456789' }],
      inserted: [],
      namesUpdated: [{ id: 'existing-user' }],
      staged: [{ id: 'existing-user', user_key: 'id:123456789' }],
    });

    await expect(
      importLegacyPaymentRows({
        members: [member({ first: 'YOONSEO', last: "O'NEIL-CHA" })],
        payments: [],
      })
    ).resolves.toMatchObject({
      namesUpdated: 1,
      usersCreated: 0,
      usersMatched: 1,
    });

    expectAnyRawSqlContaining([
      'SET "name" = prepared.name',
      'target."name" = upper(target."name")',
    ]);
  });

  it('imports legacy users and payments without storing legacy usernames', async () => {
    mockLegacyUserSqlSequence({
      inserted: [
        {
          id: 'imported-user-1',
          sailing_card_number: 110,
          user_key: 'id:AUTO0001',
        },
      ],
      staged: [
        { id: 'imported-user-1', user_key: 'id:123456789' },
        { id: 'imported-user-1', user_key: 'id:AUTO0001' },
      ],
    });

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
      namesUpdated: 0,
      paymentsImported: 1,
      paymentsNeedingReview: 0,
      usersCreated: 1,
      usersMatched: 0,
    });

    expectAnyRawSqlContaining(['CREATE TEMP TABLE legacy_import_users']);
    expectAnyRawSqlContaining(['INSERT INTO legacy_import_users']);
    expectAnyRawSqlContaining(['prepared.app_role::"AppRole"']);
    expect(allRawSqlCalls().join('\n')).not.toContain(
      'legacy_import_credential_accounts'
    );
    expect(allRawSqlCalls().join('\n')).not.toContain('INSERT INTO "account"');
    expect(allRawSqlCalls().join('\n')).not.toContain('username');
    expect(allRawSqlCalls().join('\n')).not.toContain('legacyUsername');
    expect(mocks.paymentCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
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
        ]),
        skipDuplicates: true,
      })
    );
  });

  it('uses staged final user ids after importing users', async () => {
    mockLegacyUserSqlSequence({
      inserted: [
        {
          id: 'generated-user-1',
          sailing_card_number: null,
          user_key: 'id:123456789',
        },
      ],
      staged: [{ id: 'persisted-user-1', user_key: 'id:123456789' }],
    });

    await importLegacyPaymentRows({
      members: [member()],
      payments: [payment()],
    });

    expect(mocks.paymentCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: 'persisted-user-1' }),
        ]),
      })
    );
  });

  it('merges legacy card data onto matched existing users without overwriting assigned cards', async () => {
    mockLegacyUserSqlSequence({
      existing: [
        { id: 'existing-user-1', user_key: 'id:123456789' },
        { id: 'existing-user-2', user_key: 'id:987654321' },
      ],
      inserted: [],
      merged: [{ id: 'existing-user-1' }],
      staged: [
        { id: 'existing-user-1', user_key: 'id:123456789' },
        { id: 'existing-user-2', user_key: 'id:987654321' },
      ],
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
      namesUpdated: 0,
      paymentsImported: 0,
      paymentsNeedingReview: 0,
      usersCreated: 0,
      usersMatched: 2,
    });

    expectAnyRawSqlContaining([
      'UPDATE "user" AS target',
      'SET "sailing_card_expires_on"',
      'lower(target."email") = prepared.email',
    ]);
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
      namesUpdated: 0,
      paymentsImported: 1,
      paymentsNeedingReview: 1,
    });

    expect(mocks.paymentCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            legacyCategory: 'Regatta',
            legacyDescription: 'Legacy regatta payment',
            purpose: PaymentPurpose.event_payment,
            status: PaymentStatus.needs_review,
            userId: null,
          }),
        ]),
      })
    );
  });

  it('parses legacy payment dates with time components', async () => {
    await importLegacyPaymentRows({
      members: [member()],
      payments: [payment({ date: '2026-05-01 15:30:00' })],
    });

    expect(mocks.paymentCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            createdAt: new Date('2026-05-01T12:00:00.000Z'),
          }),
        ]),
      })
    );
  });

  it('only updates unresolved existing payment status on legacy reimport', async () => {
    mocks.paymentFindMany.mockResolvedValueOnce([{ legacySourceId: '1001' }]);

    await importLegacyPaymentRows({
      members: [member()],
      payments: [payment({ settled: '1' })],
    });

    expect(mocks.paymentCreateMany).not.toHaveBeenCalled();
    expectAnyRawSqlContaining([
      'UPDATE "payments" AS target',
      `WHEN target."status" = 'needs_review'`,
      'THEN source.status::text::"payment_status"',
      '"updated_at" = NOW()',
      '"legacy_source_id" = source.legacy_source_id',
    ]);
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

    expect(mocks.paymentCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            cardType: SailingCardType.racing,
            cardYear: 2027,
            purpose: PaymentPurpose.membership,
            status: PaymentStatus.needs_review,
            userId: null,
          }),
        ]),
      })
    );
  });

  it('imports multiple payments with one lookup and one bulk insert', async () => {
    await importLegacyPaymentRows({
      members: [member()],
      payments: [payment({ omarsid: '1001' }), payment({ omarsid: '1002' })],
    });

    expect(mocks.paymentFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.paymentFindMany).toHaveBeenCalledWith({
      select: { legacySourceId: true },
      where: {
        legacySourceId: { in: ['1001', '1002'] },
        legacySourceTable: 'payments',
      },
    });
    expect(mocks.paymentCreateMany).toHaveBeenCalledTimes(1);
    expect(mocks.paymentCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ legacySourceId: '1001' }),
          expect.objectContaining({ legacySourceId: '1002' }),
        ]),
        skipDuplicates: true,
      })
    );
  });
});
