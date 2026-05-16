import { describe, expect, it } from 'vitest';
import {
  chunkRows,
  copyMysqlTableToPostgres,
  createMirrorTable,
  flattenRowsForInsert,
  MIRROR_ROW_BATCH_SIZE,
  resetLegacySchema,
} from '@/libs/legacy-sync/postgresMirrorLoader';
import type { MirrorPgClient } from '@/libs/legacy-sync/postgresMirrorLoader';

async function* mirrorBatchRows() {
  await Promise.resolve();
  yield { a: 'one', b: 1 };
}

describe('postgresMirrorLoader', () => {
  it('chunks rows', () => {
    expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('throws RangeError when chunk size is not a positive integer', () => {
    for (const size of [0, -1, 1.5, Number.NaN]) {
      expect(() => chunkRows([1], size)).toThrow(RangeError);
      expect(() => chunkRows([1], size)).toThrow(
        `chunkRows size must be a positive integer, received ${size}`
      );
    }
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

  it('copies streamed mysql rows into postgres in batches', async () => {
    const pgQueries: { sql: string; values?: unknown[] }[] = [];
    const pg: MirrorPgClient = {
      query: async (sql, values) => {
        pgQueries.push({ sql, values });
        await Promise.resolve();
        return { rows: [] };
      },
    };

    await expect(
      copyMysqlTableToPostgres({
        pg,
        rows: mirrorBatchRows(),
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

  it('buffers streamed rows up to mirror batch size', async () => {
    const pgInsertCount = { value: 0 };
    const pg: MirrorPgClient = {
      query: async () => {
        pgInsertCount.value += 1;
        await Promise.resolve();
        return { rows: [] };
      },
    };

    async function* rows() {
      for (let index = 0; index < MIRROR_ROW_BATCH_SIZE; index += 1) {
        yield { a: `row-${index}`, b: index };
      }
      yield { a: 'last', b: MIRROR_ROW_BATCH_SIZE };
    }

    await expect(
      copyMysqlTableToPostgres({
        pg,
        rows: rows(),
        table: {
          tableName: 'example',
          columns: [
            { name: 'a', nullable: true, postgresType: 'text' },
            { name: 'b', nullable: true, postgresType: 'integer' },
          ],
        },
      })
    ).resolves.toBe(MIRROR_ROW_BATCH_SIZE + 1);

    expect(pgInsertCount.value).toBe(2);
  });
});
