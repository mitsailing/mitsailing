import mysql from 'mysql2/promise';
import type { PoolConnection } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';
import type { LegacyMysqlRowStreamPool } from '@/libs/legacy-sync/mysqlConnection';
import {
  LEGACY_MYSQL_SOURCE,
  legacyMysqlPoolOptions,
  openLegacyMysqlConnection,
  streamLegacyMysqlTableRows,
} from '@/libs/legacy-sync/mysqlConnection';
import { MIRROR_ROW_BATCH_SIZE } from '@/libs/legacy-sync/postgresMirrorLoader';

async function* mirrorTestRows() {
  await Promise.resolve();
  yield { id: 1 };
  yield { id: 2 };
}

async function* mirrorTestRowsEarlyBreak() {
  yield { id: 1 };
  yield { id: 2 };
}

const mysqlMocks = vi.hoisted(() => {
  const end = vi.fn(async () => {
    await Promise.resolve();
  });
  return {
    createPool: vi.fn(() => ({ end })),
    end,
  };
});

vi.mock('mysql2/promise', () => ({
  default: {
    createPool: mysqlMocks.createPool,
  },
}));

describe('legacyMysqlPoolOptions', () => {
  it('builds pool options from the fixed legacy source and password', () => {
    expect(legacyMysqlPoolOptions('secret')).toMatchObject({
      database: LEGACY_MYSQL_SOURCE.database,
      host: LEGACY_MYSQL_SOURCE.host,
      password: 'secret',
      port: LEGACY_MYSQL_SOURCE.port,
      supportBigNumbers: true,
      bigNumberStrings: true,
      user: LEGACY_MYSQL_SOURCE.user,
    });
  });

  it('opens and closes a legacy mysql pool', async () => {
    const connection = openLegacyMysqlConnection({ password: 'secret' });

    await connection.close();

    expect(mysql.createPool).toHaveBeenCalledWith(
      expect.objectContaining({
        database: LEGACY_MYSQL_SOURCE.database,
        host: LEGACY_MYSQL_SOURCE.host,
        password: 'secret',
      })
    );
    expect(mysqlMocks.end).toHaveBeenCalledOnce();
  });
});

describe('streamLegacyMysqlTableRows', () => {
  it('streams rows from a dedicated connection and always releases it', async () => {
    const release = vi.fn();
    const stream = vi.fn(() => mirrorTestRows());
    const query = vi.fn(() => ({ stream }));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- mysql2 PoolConnection mock for streaming
    const poolConnection = {
      connection: { query },
      release,
    } as unknown as PoolConnection;
    const getConnection = vi.fn<LegacyMysqlRowStreamPool['getConnection']>(
      async () => {
        await Promise.resolve();
        return poolConnection;
      }
    );
    const pool: LegacyMysqlRowStreamPool = { getConnection };

    const collected: Record<string, unknown>[] = [];
    for await (const row of streamLegacyMysqlTableRows(pool, 'members')) {
      collected.push(row);
    }

    expect(getConnection).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith('SELECT * FROM `members`');
    expect(stream).toHaveBeenCalledWith({
      highWaterMark: MIRROR_ROW_BATCH_SIZE,
    });
    expect(release).toHaveBeenCalledOnce();
    expect(collected).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('releases the connection when the consumer stops early', async () => {
    const release = vi.fn();
    const stream = vi.fn(() => mirrorTestRowsEarlyBreak());
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- mysql2 PoolConnection mock for streaming
    const poolConnection = {
      connection: { query: () => ({ stream }) },
      release,
    } as unknown as PoolConnection;
    const getConnection = vi.fn<LegacyMysqlRowStreamPool['getConnection']>(
      async () => {
        await Promise.resolve();
        return poolConnection;
      }
    );
    const pool: LegacyMysqlRowStreamPool = { getConnection };

    for await (const row of streamLegacyMysqlTableRows(pool, 'members')) {
      if (row.id === 1) {
        break;
      }
    }

    expect(release).toHaveBeenCalledOnce();
  });
});
