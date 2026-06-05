import { importLegacyEventsFromSchema } from '@/libs/legacy-sync/legacyEventImport';
import type { LegacyEventImportResult } from '@/libs/legacy-sync/legacyEventImport';
import { importLegacyNewsFromSchema } from '@/libs/legacy-sync/legacyNewsImport';
import type { LegacyNewsImportResult } from '@/libs/legacy-sync/legacyNewsImport';
import { importLegacyPavilionReservationsFromSchema } from '@/libs/legacy-sync/legacyPavilionReservationImport';
import type { LegacyPavilionReservationImportResult } from '@/libs/legacy-sync/legacyPavilionReservationImport';
import {
  importLegacyPaymentsFromSchema,
  importLegacyUsersFromSchema,
} from '@/libs/legacy-sync/legacyPaymentImport';
import type {
  LegacyPaymentImportResult,
  LegacyUserImportResult,
} from '@/libs/legacy-sync/legacyPaymentImport';
import { importLegacyRatingsFromSchema } from '@/libs/legacy-sync/legacyRatingImport';
import type { LegacyRatingImportResult } from '@/libs/legacy-sync/legacyRatingImport';

export type LegacyDataImportResult = {
  readonly events: LegacyEventImportResult;
  readonly news: LegacyNewsImportResult;
  readonly pavilionReservations: LegacyPavilionReservationImportResult;
  readonly payments: LegacyPaymentImportResult;
  readonly ratings: LegacyRatingImportResult;
  readonly users: LegacyUserImportResult;
};

export async function importLegacyDataFromSchema(): Promise<LegacyDataImportResult> {
  const users = await importLegacyUsersFromSchema();
  const events = await importLegacyEventsFromSchema();
  const ratings = await importLegacyRatingsFromSchema();
  const news = await importLegacyNewsFromSchema();
  const pavilionReservations =
    await importLegacyPavilionReservationsFromSchema();
  const payments = await importLegacyPaymentsFromSchema();
  return { events, news, pavilionReservations, payments, ratings, users };
}
