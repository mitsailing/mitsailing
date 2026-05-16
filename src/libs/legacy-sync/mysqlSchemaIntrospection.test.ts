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
      query: async (sql, values) => {
        queries.push({ sql, values });
        await Promise.resolve();
        return [[{ tableName: 'members' }, { tableName: 'reservations' }], []];
      },
    };

    await expect(
      listMysqlBaseTables({ database: 'sailing', mysql })
    ).resolves.toEqual(['members', 'reservations']);
    expect(queries[0]?.values).toEqual(['sailing']);
  });

  describe('listMysqlBaseTables', () => {
    it('rejects non-array query results', async () => {
      const mysql: MysqlQueryClient = {
        query: async () => {
          await Promise.resolve();
          return [{ tableName: 'members' }, []];
        },
      };

      await expect(
        listMysqlBaseTables({ database: 'sailing', mysql })
      ).rejects.toThrow('expected query rows to be an array');
    });

    it('rejects rows missing tableName', async () => {
      const mysql: MysqlQueryClient = {
        query: async () => {
          await Promise.resolve();
          return [[{ tableName: 'members' }, { notTableName: 'x' }], []];
        },
      };

      await expect(
        listMysqlBaseTables({ database: 'sailing', mysql })
      ).rejects.toThrow('string tableName');
    });

    it('accepts an empty table list', async () => {
      const mysql: MysqlQueryClient = {
        query: async () => {
          await Promise.resolve();
          return [[], []];
        },
      };

      await expect(
        listMysqlBaseTables({ database: 'sailing', mysql })
      ).resolves.toEqual([]);
    });
  });

  describe('readMysqlTableDefinition', () => {
    it('rejects non-array query results', async () => {
      const mysql: MysqlQueryClient = {
        query: async () => {
          await Promise.resolve();
          return [null, []];
        },
      };

      await expect(
        readMysqlTableDefinition({
          database: 'sailing',
          mysql,
          tableName: 'reservations',
        })
      ).rejects.toThrow('expected query rows to be an array');
    });

    it('rejects rows with invalid column metadata', async () => {
      const mysql: MysqlQueryClient = {
        query: async () => {
          await Promise.resolve();
          return [
            [
              {
                columnName: 'resid',
                columnType: 'char(24)',
                isNullable: 'NO',
              },
              { columnName: 'bad', columnType: 1, isNullable: 'MAYBE' },
            ],
            [],
          ];
        },
      };

      await expect(
        readMysqlTableDefinition({
          database: 'sailing',
          mysql,
          tableName: 'reservations',
        })
      ).rejects.toThrow('columnName');
    });
  });

  it('reads mysql table definitions', async () => {
    const mysql: MysqlQueryClient = {
      query: async () => {
        await Promise.resolve();
        return [
          [
            {
              columnName: 'resid',
              columnType: 'char(24)',
              isNullable: 'NO',
            },
          ],
          [],
        ];
      },
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
