/** BullMQ six-field cron (seconds first): top of each hour. */
export const LEGACY_MYSQL_SYNC_DEFAULT_CRON = '0 0 * * * *';

const BULLMQ_CRON_FIELD = /^[0-9*,/-]+$/;

/**
 * Returns whether `value` is a six-field BullMQ cron pattern (seconds first).
 *
 * @param value - Cron string from env (e.g. `0 0 * * * *`).
 * @returns True when the pattern has six valid BullMQ fields.
 */
export function isLegacyMysqlSyncCronPattern(value: string): boolean {
  const fields = value.trim().split(/\s+/);
  if (fields.length !== 6) {
    return false;
  }
  return fields.every(
    (field) => field.length > 0 && BULLMQ_CRON_FIELD.test(field)
  );
}

export const LEGACY_MYSQL_SYNC_JOB_NAME = 'legacy-mysql-sync';

export const LEGACY_MYSQL_SYNC_SCHEDULER_ID = 'legacy-mysql-sync-hourly';
