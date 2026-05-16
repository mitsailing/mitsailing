import {
  buildCreateTableSql,
  buildInsertSql,
  legacySchemaResetSql,
} from '@/libs/legacy-sync/postgresMirrorSql';
import type { MirrorTableDefinition } from '@/libs/legacy-sync/postgresMirrorSql';

/** Postgres insert batch size; also used as mysql2 stream `highWaterMark`. */
export const MIRROR_ROW_BATCH_SIZE = 1000;

export type MirrorPgClient = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
};

export function chunkRows<T>(rows: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new RangeError(
      `chunkRows size must be a positive integer, received ${size}`
    );
  }
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

export function flattenRowsForInsert(
  rows: readonly Record<string, unknown>[],
  columnNames: readonly string[]
): unknown[] {
  return rows.flatMap((row) =>
    columnNames.map((columnName) => row[columnName])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function resetLegacySchema(pg: MirrorPgClient): Promise<void> {
  for (const sql of legacySchemaResetSql()) {
    await pg.query(sql);
  }
}

export async function createMirrorTable(props: {
  pg: MirrorPgClient;
  table: MirrorTableDefinition;
}): Promise<void> {
  await props.pg.query(buildCreateTableSql(props.table));
}

async function insertMirrorRowBatch(props: {
  columnNames: readonly string[];
  pg: MirrorPgClient;
  rows: readonly Record<string, unknown>[];
  table: MirrorTableDefinition;
}): Promise<void> {
  if (props.rows.length === 0) {
    return;
  }
  await props.pg.query(
    buildInsertSql(props.table.tableName, props.columnNames, props.rows.length),
    flattenRowsForInsert(props.rows, props.columnNames)
  );
}

/**
 * Copies streamed MySQL rows into the legacy Postgres mirror table in bounded batches.
 *
 * @param props - Postgres client, row stream, and mirror table definition.
 * @returns Number of rows copied.
 */
export async function copyMysqlTableToPostgres(props: {
  pg: MirrorPgClient;
  rows: AsyncIterable<unknown>;
  table: MirrorTableDefinition;
}): Promise<number> {
  const columnNames = props.table.columns.map((column) => column.name);
  let batch: Record<string, unknown>[] = [];
  let totalRows = 0;

  for await (const row of props.rows) {
    if (!isRecord(row)) {
      continue;
    }
    batch.push(row);
    if (batch.length >= MIRROR_ROW_BATCH_SIZE) {
      await insertMirrorRowBatch({
        columnNames,
        pg: props.pg,
        rows: batch,
        table: props.table,
      });
      totalRows += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    await insertMirrorRowBatch({
      columnNames,
      pg: props.pg,
      rows: batch,
      table: props.table,
    });
    totalRows += batch.length;
  }

  return totalRows;
}
