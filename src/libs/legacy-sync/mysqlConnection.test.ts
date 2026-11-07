import mysql from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';
import {
  LEGACY_MYSQL_SOURCE,
  legacyMysqlPoolOptions,
  openLegacyMysqlConnection,
} from '@/libs/legacy-sync/mysqlConnection';

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
    expect(legacyMysqlPoolOptions('secret', {})).toMatchObject({
      database: LEGACY_MYSQL_SOURCE.database,
      dateStrings: true,
      host: LEGACY_MYSQL_SOURCE.host,
      password: 'secret',
      port: LEGACY_MYSQL_SOURCE.port,
      supportBigNumbers: true,
      bigNumberStrings: true,
      user: LEGACY_MYSQL_SOURCE.user,
    });
  });

  it('uses host and port overrides from env', () => {
    expect(
      legacyMysqlPoolOptions('secret', {
        LEGACY_MYSQL_HOST: '127.0.0.1',
        LEGACY_MYSQL_PORT: 13_306,
      })
    ).toMatchObject({
      host: '127.0.0.1',
      port: 13_306,
    });
  });

  it('opens and closes a legacy mysql pool', async () => {
    const connection = openLegacyMysqlConnection({
      password: 'secret',
      env: {},
    });

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
