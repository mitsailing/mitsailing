import { describe, expect, it } from 'vitest';
import {
  releaseLegacyMysqlSyncLock,
  runLegacyMirrorTransaction,
  runLegacyMysqlSync,
  tryAcquireLegacyMysqlSyncLock,
} from '@/libs/legacy-sync/legacyMysqlSync';
import type {
  AdvisoryLockClient,
  MirrorTransactionClient,
} from '@/libs/legacy-sync/legacyMysqlSync';

describe('runLegacyMysqlSync', () => {
  it('exposes the production sync runner', () => {
    expect(runLegacyMysqlSync).toBeTypeOf('function');
  });
});

describe('legacy mysql sync advisory lock', () => {
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

  it('rejects malformed advisory lock rows', async () => {
    const pg: AdvisoryLockClient = {
      query: async () => {
        await Promise.resolve();
        return { rows: [{ locked: true }] };
      },
    };

    await expect(tryAcquireLegacyMysqlSyncLock(pg)).rejects.toThrow(
      'Invalid advisory lock response'
    );
  });
});

describe('runLegacyMirrorTransaction', () => {
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

  it('reports rollback failure with the load failure attached', async () => {
    const pg: MirrorTransactionClient = {
      query: async (sql) => {
        await Promise.resolve();
        if (sql === 'ROLLBACK') {
          throw new Error('rollback failed');
        }
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
    ).rejects.toMatchObject({
      cause: expect.objectContaining({ message: 'rollback failed' }),
      message: 'copy failed',
    });
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
