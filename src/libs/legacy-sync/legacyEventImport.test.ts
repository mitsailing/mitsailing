import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importLegacyEventRows } from '@/libs/legacy-sync/legacyEventImport';
import { legacyImportTransactionOptions } from '@/libs/legacy-sync/legacyImportTransaction';
import type { LegacyMemberRow } from '@/libs/legacy-sync/legacyMemberIdentity';

const mocks = vi.hoisted(() => ({
  eventCategoryUpsert: vi.fn(),
  eventFindUnique: vi.fn(),
  eventUpsert: vi.fn(),
  executeRaw: vi.fn(),
  loggerWarn: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
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

const legacyEventId = '4efb80f630ccecb2d3b9b2087b0f9c89';
const otherLegacyEventId = '415185ea244ea2b2bedeb0449b926802';
const missingCategoryLegacyEventId = 'baed9f51d412c2514ee46a0942138ad6';

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
    description:
      '<p>Legacy <strong>racing</strong> weekend</p><script>alert("x")</script>',
    desc_type: null,
    eid: overrides.eid ?? legacyEventId,
    event_type: overrides.event_type ?? '1',
    faq: '<p>FAQ <em>body</em></p><script>alert("faq")</script>',
    faq_page: '1',
    has_fee: '1',
    menu: '1',
    name: 'Legacy Racing Weekend',
    nor: '<p>Notice body</p><script>alert("notice")</script>',
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
    results: '<p>Results body</p><script>alert("results")</script>',
    short_name: 'Legacy Race',
    si: '<ul><li>Instructions body</li></ul><script>alert("si")</script>',
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
    mocks.eventFindUnique.mockResolvedValue(null);
    mocks.queryRaw.mockResolvedValue([]);
    mocks.transaction.mockImplementation(
      (operation: (tx: unknown) => unknown) =>
        operation({
          $executeRaw: mocks.executeRaw,
          $queryRaw: mocks.queryRaw,
          event: {
            findUnique: mocks.eventFindUnique,
            upsert: mocks.eventUpsert,
          },
          eventCategory: { upsert: mocks.eventCategoryUpsert },
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
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      legacyImportTransactionOptions
    );
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
            eid: legacyEventId,
            end: '10:30:00',
            start: '09:00:00',
          },
        ],
        events: [
          {
            ask_notes: null,
            boat_size: null,
            description: 'Summer race',
            desc_type: null,
            eid: legacyEventId,
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

  it('uses legacy event ids as imported public slugs', async () => {
    mocks.eventCategoryUpsert.mockResolvedValue({ id: 'category-1' });
    mocks.eventUpsert.mockResolvedValue({ id: 'event-1' });

    await importLegacyEventRows({
      boats: [],
      contacts: [],
      dates: [],
      events: [legacyEventRow({ eid: legacyEventId })],
      eventTypes: [{ name: 'Racing', rank: '1', type: '1' }],
      fees: [],
      members: [],
      registrations: [],
    });

    expect(mocks.eventUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          legacyEventId,
          slug: legacyEventId,
        }),
        update: expect.not.objectContaining({
          slug: expect.any(String),
        }),
      })
    );
  });

  it('repairs stale generated legacy slugs without overwriting custom slugs', async () => {
    mocks.eventCategoryUpsert.mockResolvedValue({ id: 'category-1' });
    mocks.eventFindUnique
      .mockResolvedValueOnce({ slug: 'legacy-c41f1cf4f3-legacy-race' })
      .mockResolvedValueOnce({ slug: 'custom-public-event' });
    mocks.eventUpsert.mockResolvedValue({ id: 'event-1' });

    await importLegacyEventRows({
      boats: [],
      contacts: [],
      dates: [],
      events: [
        legacyEventRow({ eid: legacyEventId }),
        legacyEventRow({ eid: otherLegacyEventId }),
      ],
      eventTypes: [{ name: 'Racing', rank: '1', type: '1' }],
      fees: [],
      members: [],
      registrations: [],
    });

    expect(mocks.eventUpsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        update: expect.objectContaining({
          slug: legacyEventId,
        }),
      })
    );
    expect(mocks.eventUpsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        update: expect.not.objectContaining({
          slug: expect.any(String),
        }),
      })
    );
  });

  it('imports event fees admins registrations and team boat members', async () => {
    mocks.eventCategoryUpsert.mockResolvedValue({ id: 'category-1' });
    mocks.eventUpsert.mockResolvedValue({ id: 'event-1' });
    mocks.queryRaw
      .mockResolvedValueOnce([
        { email: 'captain@example.com', id: 'app-user-captain' },
        { email: 'crew@example.com', id: 'app-user-crew' },
        { email: 'admin@example.com', id: 'app-user-admin' },
      ])
      .mockResolvedValueOnce([
        {
          legacy_team_key: `${legacyEventId}:team-alpha`,
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
            eid: legacyEventId,
            name: 'Crew Member',
            team_id: 'team-alpha',
          },
          {
            boat_num: '7',
            boat_pos: '0',
            e_mail: 'CREW@EXAMPLE.COM',
            eid: legacyEventId,
            name: 'Crew Member',
            team_id: 'team-alpha',
          },
          {
            boat_num: '0',
            boat_pos: '1',
            e_mail: 'skip@example.com',
            eid: legacyEventId,
            name: 'Skipped Crew',
            team_id: 'team-alpha',
          },
        ],
        contacts: [
          { eid: legacyEventId, userid: 'captain-legacy' },
          { eid: legacyEventId, userid: 'admin-legacy' },
          { eid: otherLegacyEventId, userid: 'captain-legacy' },
        ],
        dates: [
          {
            date: '2026-07-01',
            eid: legacyEventId,
            end: '01:00:00',
            start: '23:30:00',
          },
          {
            date: 'not-a-date',
            eid: legacyEventId,
            end: '10:00:00',
            start: '09:00:00',
          },
        ],
        events: [
          legacyEventRow(),
          legacyEventRow({
            eid: missingCategoryLegacyEventId,
            event_type: '999',
          }),
        ],
        eventTypes: [{ name: 'Racing', rank: '1', type: '1' }],
        fees: [
          { eid: legacyEventId, feeid: 'fee-1', name: '', price: '12.34' },
          {
            eid: legacyEventId,
            feeid: 'fee-bad',
            name: 'Bad fee',
            price: 'bad',
          },
          {
            eid: legacyEventId,
            feeid: 'fee-negative',
            name: 'Debt fee',
            price: '-1',
          },
          {
            eid: legacyEventId,
            feeid: 'fee-zero',
            name: 'Zero fee',
            price: '0',
          },
          {
            eid: legacyEventId,
            feeid: 'fee-deposit',
            name: 'Damage deposit',
            price: '100.00',
          },
          {
            eid: legacyEventId,
            feeid: null,
            name: 'Skipped fee',
            price: '99.00',
          },
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
            eid: legacyEventId,
            team_id: 'team-alpha',
            team_name: '',
            userid: 'captain-legacy',
          },
          {
            activereg: '1',
            confirm: '0',
            eid: legacyEventId,
            team_id: null,
            team_name: null,
            userid: 'crew-legacy',
          },
          {
            activereg: '0',
            confirm: '1',
            eid: legacyEventId,
            team_id: null,
            team_name: null,
            userid: 'admin-legacy',
          },
          {
            activereg: '1',
            confirm: '1',
            eid: legacyEventId,
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
          description: '<p>Legacy <strong>racing</strong> weekend</p>',
          legacyEventId,
          maxParticipants: 42,
          paymentDeadlineAt: new Date('2026-07-01T03:59:59.999Z'),
          paymentsEnabled: true,
          personsPerBoat: 3,
          registrationEnd: new Date('2026-07-01T03:59:59.999Z'),
          registrationMode: 'standard',
          requiresApproval: true,
          requiresPhone: true,
          slug: legacyEventId,
          usesTeamRegistration: true,
        }),
        update: expect.objectContaining({
          faqContent: '<p>FAQ <em>body</em></p>',
          faqVisible: true,
          noticeOfRaceContent: '<p>Notice body</p>',
          resultsContent: '<p>Results body</p>',
          resultsVisible: true,
          sailingInstructionsContent: '<ul><li>Instructions body</li></ul>',
        }),
      })
    );
    expect(mocks.eventUpsert.mock.calls[0]?.[0].update).not.toEqual(
      expect.objectContaining({ slug: expect.any(String) })
    );
    expect(mocks.queryRaw).toHaveBeenCalled();
    const values = allSqlValues();
    expect(values).toEqual(
      expect.arrayContaining([
        'event_fee:fee-1',
        'Legacy fee',
        1234,
        'app-user-captain',
        'app-user-admin',
        `event_reg:${legacyEventId}:captain-legacy:team-alpha`,
        `${legacyEventId}:team-alpha`,
        'approved',
        'Legacy team team-alpha',
        `event_reg:${legacyEventId}:crew-legacy:`,
        'pending',
        `event_reg:${legacyEventId}:admin-legacy:`,
        'cancelled',
        `event_boat:${legacyEventId}:team-alpha:7:0`,
        'crew@example.com',
        'Crew Member',
        7,
        0,
      ])
    );
    expect(
      values.filter(
        (value) => value === `event_boat:${legacyEventId}:team-alpha:7:0`
      )
    ).toHaveLength(1);
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
        legacyEventId,
        normalizedEndDateTime: '2026-07-02T05:00:00.000Z',
        originalEndDateTime: '2026-07-01T05:00:00.000Z',
      })
    );
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Skipped legacy event fee with invalid amount',
      expect.objectContaining({
        legacyEventId,
        legacyFeeId: 'fee-bad',
        price: 'bad',
      })
    );
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Skipped legacy event fee with invalid amount',
      expect.objectContaining({
        legacyEventId,
        legacyFeeId: 'fee-negative',
        price: '-1',
      })
    );
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Skipped legacy event fee with invalid amount',
      expect.objectContaining({
        legacyEventId,
        legacyFeeId: 'fee-zero',
        price: '0',
      })
    );
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Skipped legacy event deposit fee',
      expect.objectContaining({
        legacyEventId,
        legacyFeeId: 'fee-deposit',
      })
    );
  });
});
