import mysql from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';
import {
  legacyMysqlPoolOptionsFromUrl,
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

describe('legacyMysqlPoolOptionsFromUrl', () => {
  it('parses the production legacy MySQL URL', () => {
    expect(
      legacyMysqlPoolOptionsFromUrl(
        'mysql://dock_readonly:secret@sailing.pavilion.lan:3306/sailing'
      )
    ).toMatchObject({
      database: 'sailing',
      host: 'sailing.pavilion.lan',
      password: 'secret',
      port: 3306,
      user: 'dock_readonly',
    });
  });

  it('opens and closes a legacy mysql pool', async () => {
    const connection = openLegacyMysqlConnection({
      mysqlUrl:
        'mysql://dock_readonly:secret@sailing.pavilion.lan:3306/sailing',
    });

    await connection.close();

    expect(mysql.createPool).toHaveBeenCalledWith(
      expect.objectContaining({
        database: 'sailing',
        host: 'sailing.pavilion.lan',
      })
    );
    expect(mysqlMocks.end).toHaveBeenCalledOnce();
  });
});
