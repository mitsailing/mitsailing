import { describe, expect, it } from 'vitest';
import type { MysqlQueryClient } from '@/libs/legacy-sync/mysqlSchemaIntrospection';
import {
  chunkRows,
  copyMysqlTableToPostgres,
  createMirrorTable,
  flattenRowsForInsert,
  quoteMysqlIdentifier,
  resetLegacySchema,
} from '@/libs/legacy-sync/postgresMirrorLoader';
import type { MirrorPgClient } from '@/libs/legacy-sync/postgresMirrorLoader';

describe('postgresMirrorLoader', () => {
  it('chunks rows', () => {
    expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('flattens row objects by column order', () => {
    expect(
      flattenRowsForInsert(
        [
          { a: 'one', b: 1 },
          { a: 'two', b: 2 },
        ],
        ['a', 'b']
      )
    ).toEqual(['one', 1, 'two', 2]);
  });

  it('quotes mysql identifiers', () => {
    expect(quoteMysqlIdentifier('odd`name')).toBe('`odd``name`');
  });

  it('resets the legacy schema', async () => {
    const queries: string[] = [];
    const pg: MirrorPgClient = {
      query: async (sql) => {
        queries.push(sql);
        await Promise.resolve();
        return { rows: [] };
      },
    };

    await resetLegacySchema(pg);

    expect(queries).toEqual([
      'DROP SCHEMA IF EXISTS "legacy" CASCADE',
      'CREATE SCHEMA "legacy"',
    ]);
  });

  it('creates mirror tables', async () => {
    const queries: string[] = [];
    const pg: MirrorPgClient = {
      query: async (sql) => {
        queries.push(sql);
        await Promise.resolve();
        return { rows: [] };
      },
    };

    await createMirrorTable({
      pg,
      table: {
        tableName: 'members',
        columns: [{ name: 'record', nullable: false, postgresType: 'bigint' }],
      },
    });

    expect(queries).toEqual([
      'CREATE TABLE "legacy"."members" ("record" bigint NOT NULL)',
    ]);
  });

  it('copies mysql rows into postgres', async () => {
    const pgQueries: { sql: string; values?: unknown[] }[] = [];
    const mysql: MysqlQueryClient = {
      query: async () => {
        await Promise.resolve();
        return [[{ a: 'one', b: 1 }], []];
      },
    };
    const pg: MirrorPgClient = {
      query: async (sql, values) => {
        pgQueries.push({ sql, values });
        await Promise.resolve();
        return { rows: [] };
      },
    };

    await expect(
      copyMysqlTableToPostgres({
        mysql,
        pg,
        table: {
          tableName: 'example',
          columns: [
            { name: 'a', nullable: true, postgresType: 'text' },
            { name: 'b', nullable: true, postgresType: 'integer' },
          ],
        },
      })
    ).resolves.toBe(1);
    expect(pgQueries).toEqual([
      {
        sql: 'INSERT INTO "legacy"."example" ("a", "b") VALUES ($1, $2)',
        values: ['one', 1],
      },
    ]);
  });
});
