import { importLegacyEvents } from '@/libs/legacy-sync/legacyEventImport';
import type { LegacyEventImportResult } from '@/libs/legacy-sync/legacyEventImport';
import { runLegacyImportWithAudit } from '@/libs/legacy-sync/legacyImportRun';
import { legacyMysqlReaderFromEnv } from '@/libs/legacy-sync/legacyMysqlReader';
import type { LegacyMysqlReader } from '@/libs/legacy-sync/legacyMysqlReader';
import { importLegacyNews } from '@/libs/legacy-sync/legacyNewsImport';
import type { LegacyNewsImportResult } from '@/libs/legacy-sync/legacyNewsImport';
import { importLegacyPavilionReservations } from '@/libs/legacy-sync/legacyPavilionReservationImport';
import type { LegacyPavilionReservationImportResult } from '@/libs/legacy-sync/legacyPavilionReservationImport';
import {
  importLegacyPayments,
  importLegacyUsers,
} from '@/libs/legacy-sync/legacyPaymentImport';
import type {
  LegacyPaymentImportResult,
  LegacyUserImportResult,
} from '@/libs/legacy-sync/legacyPaymentImport';
import { importLegacyRatings } from '@/libs/legacy-sync/legacyRatingImport';
import type { LegacyRatingImportResult } from '@/libs/legacy-sync/legacyRatingImport';

type LegacyDataImportResult = {
  readonly events: LegacyEventImportResult;
  readonly news: LegacyNewsImportResult;
  readonly pavilionReservations: LegacyPavilionReservationImportResult;
  readonly payments: LegacyPaymentImportResult;
  readonly ratings: LegacyRatingImportResult;
  readonly users: LegacyUserImportResult;
};

function legacyImportRowCount(result: LegacyDataImportResult): bigint {
  const { events, news, pavilionReservations, payments, ratings, users } =
    result;
  return BigInt(
    users.usersCreated +
      users.usersMatched +
      events.eventsImported +
      events.registrationsImported +
      ratings.userRatingsImported +
      news.imported +
      pavilionReservations.imported +
      payments.paymentsImported
  );
}

async function importLegacyDataWithReader(
  reader: LegacyMysqlReader
): Promise<LegacyDataImportResult> {
  const users = await importLegacyUsers(reader);
  const events = await importLegacyEvents(reader);
  const ratings = await importLegacyRatings(reader);
  const news = await importLegacyNews(reader);
  const pavilionReservations = await importLegacyPavilionReservations(reader);
  const payments = await importLegacyPayments({ reader });
  return { events, news, pavilionReservations, payments, ratings, users };
}

export type ImportLegacyDataOptions = {
  readonly reader?: LegacyMysqlReader;
  readonly sourceHost?: string;
  readonly useAdvisoryLock?: boolean;
};

export type LegacyDataImportOutcome =
  | { readonly result: LegacyDataImportResult; readonly skipped: false }
  | { readonly skipped: true };

/**
 * Imports legacy sailing data from MySQL into app tables.
 *
 * @param options - Reader override, source host, and advisory-lock flag
 * @returns Import result or a skipped outcome when the lock is held
 */
export async function importLegacyData(
  options: ImportLegacyDataOptions = {}
): Promise<LegacyDataImportOutcome> {
  const reader = options.reader ?? legacyMysqlReaderFromEnv();
  const ownsReader = options.reader === undefined;

  try {
    const audited = await runLegacyImportWithAudit({
      importRows: async () => {
        const result = await importLegacyDataWithReader(reader);
        return result;
      },
      recordImportedRows: (result) => ({
        rowCount: legacyImportRowCount(result),
        tableCount: 12,
      }),
      sourceHost: options.sourceHost,
      useAdvisoryLock: options.useAdvisoryLock,
    });
    if (audited.skipped) {
      return { skipped: true };
    }
    return { result: audited.result, skipped: false };
  } finally {
    if (ownsReader) {
      await reader.close();
    }
  }
}
