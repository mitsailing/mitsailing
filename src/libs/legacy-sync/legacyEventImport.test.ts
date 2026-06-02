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
});
