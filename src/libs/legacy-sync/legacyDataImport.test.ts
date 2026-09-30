import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importLegacyData } from '@/libs/legacy-sync/legacyDataImport';

const mocks = vi.hoisted(() => ({
  importEvents: vi.fn(),
  importNews: vi.fn(),
  importPavilionReservations: vi.fn(),
  importPayments: vi.fn(),
  importRatings: vi.fn(),
  importUsers: vi.fn(),
  runLegacyImportWithAudit: vi.fn(),
}));

vi.mock('@/libs/legacy-sync/legacyEventImport', () => ({
  importLegacyEvents: mocks.importEvents,
}));

vi.mock('@/libs/legacy-sync/legacyNewsImport', () => ({
  importLegacyNews: mocks.importNews,
}));

vi.mock('@/libs/legacy-sync/legacyPavilionReservationImport', () => ({
  importLegacyPavilionReservations: mocks.importPavilionReservations,
}));

vi.mock('@/libs/legacy-sync/legacyPaymentImport', () => ({
  importLegacyPayments: mocks.importPayments,
  importLegacyUsers: mocks.importUsers,
}));

vi.mock('@/libs/legacy-sync/legacyRatingImport', () => ({
  importLegacyRatings: mocks.importRatings,
}));

vi.mock('@/libs/legacy-sync/legacyImportRun', () => ({
  runLegacyImportWithAudit: mocks.runLegacyImportWithAudit,
}));

describe('importLegacyData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.importUsers.mockResolvedValue({
      cardRecordsMerged: 0,
      namesUpdated: 0,
      usersCreated: 1,
      usersMatched: 0,
    });
    mocks.importEvents.mockResolvedValue({
      adminsImported: 0,
      boatMembersImported: 0,
      categoriesImported: 0,
      datesImported: 0,
      eventsImported: 0,
      feesImported: 0,
      registrationsImported: 0,
      registrationsSkipped: 0,
    });
    mocks.importRatings.mockResolvedValue({
      catalogGrantsMoved: 0,
      catalogDuplicatesRemoved: 0,
      legacyCatalogRowsHidden: 0,
      ratingTypesImported: 0,
      techRatingsImplied: 0,
      userRatingsImported: 0,
      userRatingsSkipped: 0,
    });
    mocks.importNews.mockResolvedValue({ imported: 0, skipped: 0 });
    mocks.importPavilionReservations.mockResolvedValue({
      imported: 0,
      skipped: 0,
    });
    mocks.importPayments.mockResolvedValue({
      cardRecordsMerged: 0,
      namesUpdated: 0,
      paymentsImported: 0,
      paymentsNeedingReview: 0,
      usersCreated: 0,
      usersMatched: 0,
    });
    mocks.runLegacyImportWithAudit.mockImplementation(
      async (props: { importRows: () => Promise<unknown> }) => ({
        result: await props.importRows(),
        skipped: false,
      })
    );
  });

  it('runs domain imports in order through the audit wrapper', async () => {
    const reader = {
      close: vi.fn(),
      fetchActiveMembers: vi.fn(),
      fetchEventBoats: vi.fn(),
      fetchEventContacts: vi.fn(),
      fetchEventDates: vi.fn(),
      fetchEventFees: vi.fn(),
      fetchEventRegs: vi.fn(),
      fetchEventTypes: vi.fn(),
      fetchEvents: vi.fn(),
      fetchNews: vi.fn(),
      fetchPayments: vi.fn(),
      fetchRatingTypes: vi.fn(),
      fetchRatings: vi.fn(),
      fetchReservations: vi.fn(),
    };

    await expect(importLegacyData({ reader })).resolves.toMatchObject({
      skipped: false,
      result: { users: { usersCreated: 1 } },
    });

    expect(mocks.runLegacyImportWithAudit).toHaveBeenCalledOnce();
    expect(mocks.importUsers).toHaveBeenCalledBefore(mocks.importEvents);
    expect(mocks.importEvents).toHaveBeenCalledBefore(mocks.importRatings);
    expect(mocks.importRatings).toHaveBeenCalledBefore(mocks.importNews);
    expect(mocks.importNews).toHaveBeenCalledBefore(
      mocks.importPavilionReservations
    );
    expect(mocks.importPavilionReservations).toHaveBeenCalledBefore(
      mocks.importPayments
    );
    expect(reader.close).not.toHaveBeenCalled();
  });
});
