import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importLegacyDataFromSchema } from '@/libs/legacy-sync/legacyDataImport';

const mocks = vi.hoisted(() => ({
  calls: [] as string[],
  importEvents: vi.fn(),
  importNews: vi.fn(),
  importPavilionReservations: vi.fn(),
  importPayments: vi.fn(),
  importRatings: vi.fn(),
  importUsers: vi.fn(),
}));

vi.mock('@/libs/legacy-sync/legacyEventImport', () => ({
  importLegacyEventsFromSchema: mocks.importEvents,
}));

vi.mock('@/libs/legacy-sync/legacyNewsImport', () => ({
  importLegacyNewsFromSchema: mocks.importNews,
}));

vi.mock('@/libs/legacy-sync/legacyPavilionReservationImport', () => ({
  importLegacyPavilionReservationsFromSchema: mocks.importPavilionReservations,
}));

vi.mock('@/libs/legacy-sync/legacyPaymentImport', () => ({
  importLegacyPaymentsFromSchema: mocks.importPayments,
  importLegacyUsersFromSchema: mocks.importUsers,
}));

vi.mock('@/libs/legacy-sync/legacyRatingImport', () => ({
  importLegacyRatingsFromSchema: mocks.importRatings,
}));

function mockImporter<T>(name: string, fn: ReturnType<typeof vi.fn>, value: T) {
  fn.mockImplementation(() => {
    mocks.calls.push(name);
    return value;
  });
}

describe('importLegacyDataFromSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.calls.length = 0;
    mockImporter('users', mocks.importUsers, {
      cardRecordsMerged: 1,
      usersCreated: 2,
      usersMatched: 3,
    });
    mockImporter('events', mocks.importEvents, {
      adminsImported: 1,
      boatMembersImported: 2,
      categoriesImported: 3,
      datesImported: 4,
      eventsImported: 5,
      feesImported: 6,
      registrationsImported: 7,
      registrationsSkipped: 8,
    });
    mockImporter('ratings', mocks.importRatings, {
      ratingTypesImported: 1,
      userRatingsImported: 2,
      userRatingsSkipped: 3,
    });
    mockImporter('news', mocks.importNews, { imported: 1 });
    mockImporter('pavilionReservations', mocks.importPavilionReservations, {
      imported: 2,
      skipped: 3,
    });
    mockImporter('payments', mocks.importPayments, {
      cardRecordsMerged: 0,
      paymentsImported: 4,
      paymentsNeedingReview: 5,
      usersCreated: 0,
      usersMatched: 0,
    });
  });

  it('imports dependent legacy data in order', async () => {
    await expect(importLegacyDataFromSchema()).resolves.toMatchObject({
      payments: { paymentsImported: 4 },
      users: { usersCreated: 2 },
    });

    expect(mocks.calls).toEqual([
      'users',
      'events',
      'ratings',
      'news',
      'pavilionReservations',
      'payments',
    ]);
  });
});
