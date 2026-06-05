import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importLegacyEventRows } from '@/libs/legacy-sync/legacyEventImport';
import type { LegacyMemberRow } from '@/libs/legacy-sync/legacyPaymentImport';

const mocks = vi.hoisted(() => ({
  eventCategoryUpsert: vi.fn(),
  eventUpsert: vi.fn(),
  executeRaw: vi.fn(),
  loggerWarn: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    warn: mocks.loggerWarn,
  },
}));

function sqlValues(value: object): readonly unknown[] | null {
  if (!('values' in value)) {
    return null;
  }
  const { values } = value;
  return Array.isArray(values) ? values : null;
}

function collectSqlDates(value: unknown): Date[] {
  if (value instanceof Date) {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectSqlDates);
  }
  if (value && typeof value === 'object') {
    const values = sqlValues(value);
    return values ? values.flatMap(collectSqlDates) : [];
  }
  return [];
}

function collectSqlValues(value: unknown): unknown[] {
  if (value instanceof Date) {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectSqlValues);
  }
  if (value && typeof value === 'object') {
    const values = sqlValues(value);
    return values ? values.flatMap(collectSqlValues) : [];
  }
  return [value];
}

function allSqlValues(): unknown[] {
  return mocks.executeRaw.mock.calls.flatMap((call) =>
    call.flatMap(collectSqlValues)
  );
}

function legacyMember(
  overrides: Partial<LegacyMemberRow> = {}
): LegacyMemberRow {
  return {
    active: '1',
    card: null,
    email: 'captain@example.com',
    emer_email: null,
    emer_name: null,
    emer_phone: null,
    expire_date: null,
    first: 'Casey',
    id: 'captain-legacy',
    last: 'Captain',
    memb_type: null,
    phone: null,
    record: null,
    record_date: null,
    status_type: null,
    username: 'captain',
    ...overrides,
  };
}

function legacyEventRow(
  overrides: {
    readonly eid?: string;
    readonly event_type?: string;
    readonly updater?: string | null;
  } = {}
) {
  return {
    ask_notes: null,
    boat_size: '3',
    deposit: null,
    description: 'Legacy racing weekend',
    desc_type: null,
    eid: overrides.eid ?? '101',
    event_type: overrides.event_type ?? '1',
    faq: 'FAQ body',
    faq_page: '1',
    has_fee: '1',
    menu: '1',
    name: 'Legacy Racing Weekend',
    nor: 'Notice body',
    nor_page: '1',
    phone: '1',
    reg_approve: '1',
    reg_begin: '2026-06-01',
    reg_custom: null,
    reg_date: '2026-06-30',
    reg_limit: '42',
    reg_page: '1',
    reg_repeatcap: '1',
    reg_team: '1',
    reg_urlentries: null,
    reg_urlreg: null,
    res_page: '1',
    results: 'Results body',
    short_name: 'Legacy Race',
    si: 'Instructions body',
    si_page: '1',
    special: '1',
    team_size: '2',
    updater: overrides.updater ?? 'admin',
    url: null,
  };
}

describe('importLegacyEventRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.executeRaw.mockResolvedValue(0);
    mocks.queryRaw.mockResolvedValue([]);
    mocks.userFindMany.mockResolvedValue([]);
    mocks.transaction.mockImplementation(
      (operation: (tx: unknown) => unknown) =>
        operation({
          $executeRaw: mocks.executeRaw,
          $queryRaw: mocks.queryRaw,
          event: { upsert: mocks.eventUpsert },
          eventCategory: { upsert: mocks.eventCategoryUpsert },
          user: { findMany: mocks.userFindMany },
        })
    );
  });

  it('runs empty legacy event imports without row writes', async () => {
    await expect(
      importLegacyEventRows({
        boats: [],
        contacts: [],
        dates: [],
        events: [],
        eventTypes: [],
        fees: [],
        members: [],
        registrations: [],
      })
    ).resolves.toEqual({
      adminsImported: 0,
      boatMembersImported: 0,
      categoriesImported: 0,
      datesImported: 0,
      eventsImported: 0,
      feesImported: 0,
      registrationsImported: 0,
      registrationsSkipped: 0,
    });

    expect(mocks.eventCategoryUpsert).not.toHaveBeenCalled();
    expect(mocks.eventUpsert).not.toHaveBeenCalled();
    expect(mocks.executeRaw).toHaveBeenCalled();
  });

  it('imports event dates as New York wall-clock instants', async () => {
    mocks.eventCategoryUpsert.mockResolvedValue({ id: 'category-1' });
    mocks.eventUpsert.mockResolvedValue({ id: 'event-1' });

    await expect(
      importLegacyEventRows({
        boats: [],
        contacts: [],
        dates: [
          {
            date: '2026-07-01',
            eid: '101',
            end: '10:30:00',
            start: '09:00:00',
          },
        ],
        events: [
          {
            ask_notes: null,
            boat_size: null,
            deposit: null,
            description: 'Summer race',
            desc_type: null,
            eid: '101',
            event_type: '1',
            faq: null,
            faq_page: null,
            has_fee: null,
            menu: '1',
            name: 'Summer Race',
            nor: null,
            nor_page: null,
            phone: null,
            reg_approve: null,
            reg_begin: '2026-06-01',
            reg_custom: null,
            reg_date: '2026-06-30',
            reg_limit: null,
            reg_page: '1',
            reg_repeatcap: null,
            reg_team: null,
            reg_urlentries: null,
            reg_urlreg: null,
            res_page: null,
            results: null,
            short_name: 'Summer Race',
            si: null,
            si_page: null,
            special: null,
            team_size: null,
            updater: null,
            url: null,
          },
        ],
        eventTypes: [{ name: 'Racing', rank: '1', type: '1' }],
        fees: [],
        members: [],
        registrations: [],
      })
    ).resolves.toEqual(
      expect.objectContaining({
        datesImported: 1,
        eventsImported: 1,
      })
    );

    const stagedDates = mocks.executeRaw.mock.calls
      .flatMap((call) => call.flatMap(collectSqlDates))
      .filter((date) => date.getUTCFullYear() === 2026);
    expect(stagedDates).toEqual(
      expect.arrayContaining([
        new Date('2026-07-01T13:00:00.000Z'),
        new Date('2026-07-01T14:30:00.000Z'),
      ])
    );
  });

  it('imports event fees admins registrations and team boat members', async () => {
    mocks.eventCategoryUpsert.mockResolvedValue({ id: 'category-1' });
    mocks.eventUpsert.mockResolvedValue({ id: 'event-1' });
    mocks.userFindMany.mockResolvedValue([
      { email: 'captain@example.com', id: 'app-user-captain' },
      { email: 'crew@example.com', id: 'app-user-crew' },
      { email: 'admin@example.com', id: 'app-user-admin' },
    ]);
    mocks.queryRaw.mockResolvedValue([
      {
        legacy_team_key: '101:team-alpha',
        registration_id: 'registration-team-alpha',
      },
    ]);

    await expect(
      importLegacyEventRows({
        boats: [
          {
            boat_num: '7',
            boat_pos: '0',
            e_mail: 'CREW@EXAMPLE.COM',
            eid: '101',
            name: 'Crew Member',
            team_id: 'team-alpha',
          },
          {
            boat_num: '0',
            boat_pos: '1',
            e_mail: 'skip@example.com',
            eid: '101',
            name: 'Skipped Crew',
            team_id: 'team-alpha',
          },
        ],
        contacts: [
          { eid: '101', userid: 'captain-legacy' },
          { eid: '101', userid: 'admin-legacy' },
          { eid: '999', userid: 'captain-legacy' },
        ],
        dates: [
          {
            date: '2026-07-01',
            eid: '101',
            end: '01:00:00',
            start: '23:30:00',
          },
          {
            date: 'not-a-date',
            eid: '101',
            end: '10:00:00',
            start: '09:00:00',
          },
        ],
        events: [
          legacyEventRow(),
          legacyEventRow({ eid: 'missing-category', event_type: '999' }),
        ],
        eventTypes: [{ name: 'Racing', rank: '1', type: '1' }],
        fees: [
          { eid: '101', feeid: 'fee-1', name: '', price: '12.34' },
          { eid: '101', feeid: 'fee-bad', name: 'Bad fee', price: 'bad' },
          { eid: '101', feeid: 'fee-negative', name: 'Debt fee', price: '-1' },
          { eid: '101', feeid: 'fee-zero', name: 'Zero fee', price: '0' },
          { eid: '101', feeid: null, name: 'Skipped fee', price: '99.00' },
        ],
        members: [
          legacyMember(),
          legacyMember({
            email: 'crew@example.com',
            first: 'Chris',
            id: 'crew-legacy',
            last: 'Crew',
            username: 'crew',
          }),
          legacyMember({
            email: 'admin@example.com',
            first: 'Alex',
            id: 'admin-legacy',
            last: 'Admin',
            username: 'admin',
          }),
        ],
        registrations: [
          {
            activereg: '1',
            confirm: '1',
            eid: '101',
            team_id: 'team-alpha',
            team_name: '',
            userid: 'captain-legacy',
          },
          {
            activereg: '1',
            confirm: '0',
            eid: '101',
            team_id: null,
            team_name: null,
            userid: 'crew-legacy',
          },
          {
            activereg: '0',
            confirm: '1',
            eid: '101',
            team_id: null,
            team_name: null,
            userid: 'admin-legacy',
          },
          {
            activereg: '1',
            confirm: '1',
            eid: '101',
            team_id: null,
            team_name: null,
            userid: 'missing-user',
          },
        ],
      })
    ).resolves.toEqual({
      adminsImported: 2,
      boatMembersImported: 1,
      categoriesImported: 1,
      datesImported: 1,
      eventsImported: 1,
      feesImported: 1,
      registrationsImported: 3,
      registrationsSkipped: 1,
    });

    expect(mocks.eventUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          boatsPerTeam: 2,
          description: 'Legacy racing weekend',
          legacyEventId: '101',
          maxParticipants: 42,
          paymentDeadlineAt: new Date('2026-07-01T03:59:59.999Z'),
          paymentsEnabled: true,
          personsPerBoat: 3,
          registrationEnd: new Date('2026-07-01T03:59:59.999Z'),
          registrationMode: 'standard',
          requiresApproval: true,
          requiresPhone: true,
          usesTeamRegistration: true,
        }),
        update: expect.objectContaining({
          faqContent: 'FAQ body',
          faqVisible: true,
          resultsContent: 'Results body',
          resultsVisible: true,
        }),
      })
    );
    expect(mocks.userFindMany).toHaveBeenCalledWith({
      select: { email: true, id: true },
      where: {
        email: {
          in: expect.arrayContaining([
            'captain@example.com',
            'crew@example.com',
            'admin@example.com',
          ]),
        },
      },
    });
    const values = allSqlValues();
    expect(values).toEqual(
      expect.arrayContaining([
        'event_fee:fee-1',
        'Legacy fee',
        1234,
        false,
        'app-user-captain',
        'app-user-admin',
        'event_reg:101:captain-legacy:team-alpha',
        '101:team-alpha',
        'approved',
        'Legacy team team-alpha',
        'event_reg:101:crew-legacy:',
        'pending',
        'event_reg:101:admin-legacy:',
        'cancelled',
        'event_boat:101:team-alpha:7:0',
        'crew@example.com',
        'Crew Member',
        7,
        0,
      ])
    );
    const stagedDates = values.filter(
      (value): value is Date => value instanceof Date
    );
    expect(stagedDates).toEqual(
      expect.arrayContaining([
        new Date('2026-07-02T03:30:00.000Z'),
        new Date('2026-07-02T05:00:00.000Z'),
      ])
    );
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Adjusted legacy event date ending before start',
      expect.objectContaining({
        legacyEventId: '101',
        normalizedEndDateTime: '2026-07-02T05:00:00.000Z',
        originalEndDateTime: '2026-07-01T05:00:00.000Z',
      })
    );
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Skipped legacy event fee with invalid amount',
      expect.objectContaining({
        legacyEventId: '101',
        legacyFeeId: 'fee-bad',
        price: 'bad',
      })
    );
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Skipped legacy event fee with invalid amount',
      expect.objectContaining({
        legacyEventId: '101',
        legacyFeeId: 'fee-negative',
        price: '-1',
      })
    );
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Skipped legacy event fee with invalid amount',
      expect.objectContaining({
        legacyEventId: '101',
        legacyFeeId: 'fee-zero',
        price: '0',
      })
    );
  });
});
