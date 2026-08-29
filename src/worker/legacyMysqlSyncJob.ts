import type { JobsOptions, Queue } from 'bullmq';
import { importLegacyData } from '@/libs/legacy-sync/legacyDataImport';
import { createLegacyMysqlReader } from '@/libs/legacy-sync/legacyMysqlReader';
import type { LegacyMysqlSyncConfig } from '@/libs/legacy-sync/legacyMysqlSyncConfig';
import {
  LEGACY_MYSQL_SYNC_JOB_NAME,
  LEGACY_MYSQL_SYNC_SCHEDULER_ID,
  legacyMysqlSyncConfigFromEnv,
} from '@/libs/legacy-sync/legacyMysqlSyncConfig';

export { LEGACY_MYSQL_SYNC_JOB_NAME } from '@/libs/legacy-sync/legacyMysqlSyncConfig';

const LEGACY_MYSQL_SYNC_JOB_OPTS: JobsOptions = {
  attempts: 2,
  backoff: { type: 'exponential', delay: 60_000 },
  removeOnComplete: { count: 10 },
  removeOnFail: { count: 20 },
};

export type LegacyMysqlSyncSchedulerQueue = Pick<
  Queue,
  'removeJobScheduler' | 'upsertJobScheduler'
>;

/**
 * Registers or removes the BullMQ scheduler from resolved sync config.
 *
 * @param queue - BullMQ queue methods used for the sync scheduler.
 * @param config - Resolved sync settings from env.
 */
export async function applyLegacyMysqlSyncScheduler(
  queue: LegacyMysqlSyncSchedulerQueue,
  config: LegacyMysqlSyncConfig
): Promise<void> {
  if (!config.enabled) {
    await queue.removeJobScheduler(LEGACY_MYSQL_SYNC_SCHEDULER_ID);
    return;
  }
  await queue.upsertJobScheduler(
    LEGACY_MYSQL_SYNC_SCHEDULER_ID,
    { pattern: config.cron },
    {
      name: LEGACY_MYSQL_SYNC_JOB_NAME,
      data: {},
      opts: LEGACY_MYSQL_SYNC_JOB_OPTS,
    }
  );
}

export async function registerLegacyMysqlSyncScheduler(
  queue: Queue
): Promise<void> {
  await applyLegacyMysqlSyncScheduler(queue, legacyMysqlSyncConfigFromEnv());
}

export async function processLegacyMysqlSyncJob(): Promise<void> {
  const config = legacyMysqlSyncConfigFromEnv();
  if (!config.enabled) {
    return;
  }
  const reader = createLegacyMysqlReader({ password: config.mysqlPassword });
  try {
    const outcome = await importLegacyData({
      reader,
      sourceHost: config.sourceHost,
      useAdvisoryLock: true,
    });
    if (!outcome.skipped) {
      // import completed
    }
  } finally {
    await reader.close();
  }
}
