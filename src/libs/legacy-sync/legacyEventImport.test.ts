import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importLegacyEventRows } from '@/libs/legacy-sync/legacyEventImport';

const mocks = vi.hoisted(() => ({
  eventCategoryUpsert: vi.fn(),
  eventUpsert: vi.fn(),
  executeRaw: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    $transaction: mocks.transaction,
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
});
