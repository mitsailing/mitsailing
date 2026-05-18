import { CronExpressionParser } from 'cron-parser';

/** BullMQ six-field cron (seconds first): top of each hour. */
export const LEGACY_MYSQL_SYNC_DEFAULT_CRON = '0 0 * * * *';

/**
 * Returns whether `value` is a six-field BullMQ cron pattern (seconds first).
 *
 * @param value - Cron string from env (e.g. `0 0 * * * *`).
 * @returns True when the pattern has six valid BullMQ fields.
 */
export function isLegacyMysqlSyncCronPattern(value: string): boolean {
  const trimmed = value.trim();
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 6) {
    return false;
  }
  try {
    CronExpressionParser.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

export const LEGACY_MYSQL_SYNC_JOB_NAME = 'legacy-mysql-sync';

export const LEGACY_MYSQL_SYNC_SCHEDULER_ID = 'legacy-mysql-sync-hourly';
