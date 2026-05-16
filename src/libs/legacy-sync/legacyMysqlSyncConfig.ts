import { Env } from '@/libs/Env';
import {
  LEGACY_MYSQL_SYNC_DEFAULT_CRON,
  LEGACY_MYSQL_SYNC_JOB_NAME,
  LEGACY_MYSQL_SYNC_SCHEDULER_ID,
} from '@/libs/legacy-sync/legacyMysqlSyncConstants';
import { LEGACY_MYSQL_SOURCE } from '@/libs/legacy-sync/mysqlConnection';

export { LEGACY_MYSQL_SYNC_JOB_NAME, LEGACY_MYSQL_SYNC_SCHEDULER_ID };

export type LegacyMysqlSyncConfig =
  | { enabled: false }
  | {
      cron: string;
      database: typeof LEGACY_MYSQL_SOURCE.database;
      enabled: true;
      mysqlPassword: string;
      sourceHost: typeof LEGACY_MYSQL_SOURCE.host;
    };

type LegacyMysqlSyncEnv = {
  LEGACY_MYSQL_PASSWORD?: string;
  LEGACY_MYSQL_SYNC_CRON?: string;
  LEGACY_MYSQL_SYNC_ENABLED?: string;
};

/**
 * Resolves legacy MySQL mirror settings from validated env (or a test override).
 *
 * @param env - Validated env or test override; defaults to `Env`.
 * @returns Enabled config with cron and credentials, or `{ enabled: false }`.
 */
export function legacyMysqlSyncConfigFromEnv(
  env: LegacyMysqlSyncEnv = Env
): LegacyMysqlSyncConfig {
  if (env.LEGACY_MYSQL_SYNC_ENABLED !== 'true') {
    return { enabled: false };
  }
  if (env.LEGACY_MYSQL_PASSWORD === undefined) {
    throw new Error(
      'LEGACY_MYSQL_PASSWORD is required when legacy sync is enabled.'
    );
  }
  return {
    enabled: true,
    cron: env.LEGACY_MYSQL_SYNC_CRON ?? LEGACY_MYSQL_SYNC_DEFAULT_CRON,
    database: LEGACY_MYSQL_SOURCE.database,
    mysqlPassword: env.LEGACY_MYSQL_PASSWORD,
    sourceHost: LEGACY_MYSQL_SOURCE.host,
  };
}
