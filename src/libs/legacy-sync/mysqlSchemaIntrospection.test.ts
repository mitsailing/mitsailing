import { describe, expect, it } from 'vitest';
import {
  listMysqlBaseTables,
  mysqlColumnsToMirrorTable,
  readMysqlTableDefinition,
} from '@/libs/legacy-sync/mysqlSchemaIntrospection';
import type { MysqlQueryClient } from '@/libs/legacy-sync/mysqlSchemaIntrospection';

describe('mysqlColumnsToMirrorTable', () => {
  it('converts information schema rows to a mirror table definition', () => {
    expect(
      mysqlColumnsToMirrorTable('reservations', [
        {
          columnName: 'resid',
          columnType: 'char(24)',
          isNullable: 'NO',
        },
        {
          columnName: 'comments',
          columnType: 'text',
          isNullable: 'YES',
        },
      ])
    ).toEqual({
      tableName: 'reservations',
      columns: [
        { name: 'resid', nullable: false, postgresType: 'char(24)' },
        { name: 'comments', nullable: true, postgresType: 'text' },
      ],
    });
  });

  it('lists mysql base tables', async () => {
    const queries: { sql: string; values?: readonly unknown[] }[] = [];
    const mysql: MysqlQueryClient = {
      query:  async (sql, values) => {
        queries.push({ sql, values });
        return Promise.resolve([
          [{ tableName: 'members' }, { tableName: 'reservations' }],
          [],
        ]);
      },
    };

    await expect(
      listMysqlBaseTables({ database: 'sailing', mysql })
    ).resolves.toEqual(['members', 'reservations']);
    expect(queries[0]?.values).toEqual(['sailing']);
  });

  it('reads mysql table definitions', async () => {
    const mysql: MysqlQueryClient = {
      query:  async () =>
        Promise.resolve([
          [
            {
              columnName: 'resid',
              columnType: 'char(24)',
              isNullable: 'NO',
            },
          ],
          [],
        ]),
    };

    await expect(
      readMysqlTableDefinition({
        database: 'sailing',
        mysql,
        tableName: 'reservations',
      })
    ).resolves.toEqual({
      tableName: 'reservations',
      columns: [{ name: 'resid', nullable: false, postgresType: 'char(24)' }],
    });
  });
});
