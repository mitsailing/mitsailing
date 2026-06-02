import 'dotenv/config';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { importLegacyDataFromSchema } from '@/libs/legacy-sync/legacyDataImport';
import { runLegacyMysqlSync } from '@/libs/legacy-sync/legacyMysqlSync';
import { LEGACY_MYSQL_SOURCE } from '@/libs/legacy-sync/mysqlConnection';

function shouldSyncLegacyMirror(): boolean {
  return process.argv.includes('--sync-legacy');
}

async function maybeSyncLegacyMirror(): Promise<void> {
  if (!shouldSyncLegacyMirror()) {
    return;
  }
  const mysqlPassword = Env.LEGACY_MYSQL_PASSWORD;
  if (!mysqlPassword) {
    throw new Error(
      'LEGACY_MYSQL_PASSWORD is required when running with --sync-legacy.'
    );
  }
  const result = await runLegacyMysqlSync({
    cron: '0 0 * * * *',
    database: LEGACY_MYSQL_SOURCE.database,
    enabled: true,
    mysqlPassword,
    sourceHost: LEGACY_MYSQL_SOURCE.host,
  });
  if (result.skipped) {
    throw new Error(
      'Legacy MySQL sync skipped because another sync is running.'
    );
  }
  console.log(
    `Synced ${result.rowCount.toString()} legacy rows across ${result.tableCount} tables.`
  );
}

async function main(): Promise<void> {
  await maybeSyncLegacyMirror();
  const result = await importLegacyDataFromSchema();
  const { users } = result;
  console.log(
    `Imported legacy users: created ${users.usersCreated}, matched ${users.usersMatched}, merged ${users.cardRecordsMerged} sailing-card records.`
  );

  const { events } = result;
  console.log(
    `Imported legacy events: categories ${events.categoriesImported}, events ${events.eventsImported}, dates ${events.datesImported}, registrations ${events.registrationsImported}, skipped registrations ${events.registrationsSkipped}, admins ${events.adminsImported}, fees ${events.feesImported}, boat members ${events.boatMembersImported}.`
  );

  const { ratings } = result;
  console.log(
    `Imported legacy ratings: rating types ${ratings.ratingTypesImported}, user ratings ${ratings.userRatingsImported}, skipped user ratings ${ratings.userRatingsSkipped}.`
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

try {
  await run();
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
