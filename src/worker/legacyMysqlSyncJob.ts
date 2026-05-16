import type { JobsOptions, Queue } from 'bullmq';
import {
  legacyMysqlSyncConfigFromEnv,
  runLegacyMysqlSync,
} from '@/libs/legacy-sync/legacyMysqlSync';
import { importLegacyPavilionReservationsFromSchema } from '@/libs/legacy-sync/legacyPavilionReservationImport';

export const LEGACY_MYSQL_SYNC_JOB_NAME = 'legacy-mysql-sync';
const LEGACY_MYSQL_SYNC_SCHEDULER_ID = 'legacy-mysql-sync-hourly';

export async function registerLegacyMysqlSyncScheduler(
  queue: Queue
): Promise<void> {
  const config = legacyMysqlSyncConfigFromEnv();
  if (!config.enabled) {
    return;
  }
  const opts: JobsOptions = {
    attempts: 2,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 20 },
  };
  await queue.upsertJobScheduler(
    LEGACY_MYSQL_SYNC_SCHEDULER_ID,
    { pattern: config.cron },
    {
      name: LEGACY_MYSQL_SYNC_JOB_NAME,
      data: {},
      opts,
    }
  );
}

export async function processLegacyMysqlSyncJob(): Promise<void> {
  const config = legacyMysqlSyncConfigFromEnv();
  if (!config.enabled) {
    return;
  }
  const result = await runLegacyMysqlSync(config);
  if (result.skipped) {
    return;
  }
  await importLegacyPavilionReservationsFromSchema();
}
