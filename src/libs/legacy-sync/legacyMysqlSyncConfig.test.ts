import { describe, expect, it } from 'vitest';
import { legacyMysqlSyncConfigFromEnv } from '@/libs/legacy-sync/legacyMysqlSyncConfig';
import { LEGACY_MYSQL_SYNC_DEFAULT_CRON } from '@/libs/legacy-sync/legacyMysqlSyncConstants';

describe('legacyMysqlSyncConfigFromEnv', () => {
  it('returns disabled config when sync flag is false', () => {
    expect(
      legacyMysqlSyncConfigFromEnv({
        LEGACY_MYSQL_SYNC_ENABLED: 'false',
      })
    ).toEqual({ enabled: false });
  });

  it('uses hourly cron by default when enabled', () => {
    const config = legacyMysqlSyncConfigFromEnv({
      LEGACY_MYSQL_PASSWORD: 'secret',
      LEGACY_MYSQL_SYNC_ENABLED: 'true',
    });

    expect(config.enabled ? config.cron : null).toBe(
      LEGACY_MYSQL_SYNC_DEFAULT_CRON
    );
  });

  it('derives source metadata from the fixed legacy mysql source', () => {
    expect(
      legacyMysqlSyncConfigFromEnv({
        LEGACY_MYSQL_PASSWORD: 'secret',
        LEGACY_MYSQL_SYNC_ENABLED: 'true',
      })
    ).toMatchObject({
      database: 'sailing',
      mysqlPassword: 'secret',
      sourceHost: 'sailing.pavilion.lan',
    });
  });
});
