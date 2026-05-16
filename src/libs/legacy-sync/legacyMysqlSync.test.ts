import { describe, expect, it } from 'vitest';
import {
  legacyMysqlSyncConfigFromEnv,
  releaseLegacyMysqlSyncLock,
  runLegacyMirrorTransaction,
  runLegacyMysqlSync,
  tryAcquireLegacyMysqlSyncLock,
} from '@/libs/legacy-sync/legacyMysqlSync';
import type {
  AdvisoryLockClient,
  MirrorTransactionClient,
} from '@/libs/legacy-sync/legacyMysqlSync';

describe('legacyMysqlSyncConfigFromEnv', () => {
  it('exposes the production sync runner', () => {
    expect(runLegacyMysqlSync).toBeTypeOf('function');
  });

  it('returns disabled config when sync flag is false', () => {
    expect(
      legacyMysqlSyncConfigFromEnv({
        APP_ENV: 'production',
        LEGACY_MYSQL_SYNC_ENABLED: 'false',
      })
    ).toEqual({ enabled: false });
  });

  it('uses hourly cron by default when enabled', () => {
    const config = legacyMysqlSyncConfigFromEnv({
      APP_ENV: 'production',
      LEGACY_MYSQL_URL:
        'mysql://dock_readonly:secret@sailing.pavilion.lan:3306/sailing',
      LEGACY_MYSQL_SYNC_ENABLED: 'true',
    });

    expect(config.enabled ? config.cron : null).toBe('0 0 * * * *');
  });

  it('derives source metadata from the MySQL URL', () => {
    expect(
      legacyMysqlSyncConfigFromEnv({
        APP_ENV: 'production',
        LEGACY_MYSQL_URL:
          'mysql://dock_readonly:secret@sailing.pavilion.lan:3306/sailing',
        LEGACY_MYSQL_SYNC_ENABLED: 'true',
      })
    ).toMatchObject({
      database: 'sailing',
      mysqlUrl:
        'mysql://dock_readonly:secret@sailing.pavilion.lan:3306/sailing',
      sourceHost: 'sailing.pavilion.lan',
    });
  });

  it('uses a fixed advisory lock for overlap prevention', async () => {
    const queries: { sql: string; values?: unknown[] }[] = [];
    const pg: AdvisoryLockClient = {
      query: async (sql, values = []) => {
        queries.push({ sql, values });
        await Promise.resolve();
        return { rows: [{ acquired: true }] };
      },
    };

    await expect(tryAcquireLegacyMysqlSyncLock(pg)).resolves.toBe(true);
    await releaseLegacyMysqlSyncLock(pg);

    expect(queries).toEqual([
      {
        sql: 'SELECT pg_try_advisory_lock($1, $2) AS acquired',
        values: [20_260_516, 1],
      },
      {
        sql: 'SELECT pg_advisory_unlock($1, $2)',
        values: [20_260_516, 1],
      },
    ]);
  });

  it('rolls back the mirror transaction when loading fails', async () => {
    const queries: string[] = [];
    const pg: MirrorTransactionClient = {
      query: async (sql) => {
        queries.push(sql);
        await Promise.resolve();
        return { rows: [] };
      },
    };

    await expect(
      runLegacyMirrorTransaction({
        pg,
        load: async () => {
          await Promise.resolve();
          throw new Error('copy failed');
        },
      })
    ).rejects.toThrow('copy failed');

    expect(queries).toEqual(['BEGIN', 'ROLLBACK']);
  });

  it('commits the mirror transaction when loading succeeds', async () => {
    const queries: string[] = [];
    const expectedRowCount = BigInt(Number.parseInt('12', 10));
    const pg: MirrorTransactionClient = {
      query: async (sql) => {
        queries.push(sql);
        await Promise.resolve();
        return { rows: [] };
      },
    };

    await expect(
      runLegacyMirrorTransaction({
        pg,
        load: async () => {
          await Promise.resolve();
          return { rowCount: expectedRowCount, tableCount: 3 };
        },
      })
    ).resolves.toEqual({ rowCount: expectedRowCount, tableCount: 3 });

    expect(queries).toEqual(['BEGIN', 'COMMIT']);
  });
});
