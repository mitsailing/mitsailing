import 'dotenv/config';
import { prisma } from '@/libs/DB';
import { importLegacyData } from '@/libs/legacy-sync/legacyDataImport';
import { assertLocalDevDatabaseForLegacyImport } from '@/libs/legacy-sync/legacyImportGuards';

async function main(): Promise<void> {
  assertLocalDevDatabaseForLegacyImport();
  const outcome = await importLegacyData({ useAdvisoryLock: false });
  if (outcome.skipped) {
    throw new Error('Legacy import skipped because another import is running.');
  }
  const { result } = outcome;
  const { users } = result;
  console.log(
    `Imported legacy users: created ${users.usersCreated}, matched ${users.usersMatched}, normalized ${users.namesUpdated} names, merged ${users.cardRecordsMerged} sailing-card records.`
  );

  const { events } = result;
  console.log(
    `Imported legacy events: categories ${events.categoriesImported}, events ${events.eventsImported}, dates ${events.datesImported}, registrations ${events.registrationsImported}, skipped registrations ${events.registrationsSkipped}, admins ${events.adminsImported}, fees ${events.feesImported}, boat members ${events.boatMembersImported}.`
  );

  const { ratings } = result;
  console.log(
    `Imported legacy ratings: catalog grants moved ${ratings.catalogGrantsMoved}, duplicates removed ${ratings.catalogDuplicatesRemoved}, legacy rows hidden ${ratings.legacyCatalogRowsHidden}, rating types ${ratings.ratingTypesImported}, tech ratings implied ${ratings.techRatingsImplied}, user ratings ${ratings.userRatingsImported}, skipped user ratings ${ratings.userRatingsSkipped}.`
  );

  const { news } = result;
  console.log(`Imported legacy news: imported ${news.imported}.`);

  const { pavilionReservations: pavilion } = result;
  console.log(
    `Imported legacy Pavilion reservations: imported ${pavilion.imported}, skipped ${pavilion.skipped}.`
  );

  const { payments } = result;
  console.log(
    `Imported legacy payments: imported ${payments.paymentsImported}, needs review ${payments.paymentsNeedingReview}.`
  );
}

async function run(): Promise<void> {
  try {
    await main();
  } finally {
    await prisma.$disconnect();
  }
}

async function runCli(): Promise<void> {
  try {
    await run();
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
  }
}

// eslint-disable-next-line no-void -- script entry
void runCli();
