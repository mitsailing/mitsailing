import {
  buildCreateTableSql,
  buildInsertSql,
  legacySchemaResetSql,
} from '@/libs/legacy-sync/postgresMirrorSql';
import type { MirrorTableDefinition } from '@/libs/legacy-sync/postgresMirrorSql';

/** Postgres insert batch size; also used as mysql2 stream `highWaterMark`. */
export const MIRROR_ROW_BATCH_SIZE = 1000;
export const POSTGRES_MAX_PARAMETERS = 65_535;

export type MirrorPgClient = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
};

export function mirrorInsertBatchSize(columnCount: number): number {
  if (!Number.isInteger(columnCount) || columnCount <= 0) {
    throw new RangeError(
      `mirrorInsertBatchSize columnCount must be a positive integer, received ${columnCount}`
    );
  }
  return Math.max(
    1,
    Math.min(
      MIRROR_ROW_BATCH_SIZE,
      Math.floor(POSTGRES_MAX_PARAMETERS / columnCount)
    )
  );
}

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
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (row === undefined) {
      throw new Error(
        `flattenRowsForInsert: row ${rowIndex} is missing (expected ${rows.length} rows)`
      );
    }
    for (const columnName of columnNames) {
      if (!Object.hasOwn(row, columnName)) {
        throw new Error(
          `flattenRowsForInsert: row ${rowIndex} is missing column "${columnName}" (expected: ${columnNames.join(', ')})`
        );
      }
    }
  }
  return rows.flatMap((row) =>
    columnNames.map((columnName) => row[columnName])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function mirrorRowPreview(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return `string ${value}`;
  }
  if (typeof value === 'number') {
    return `number ${value}`;
  }
  if (typeof value === 'boolean') {
    return `boolean ${value}`;
  }
  if (typeof value === 'bigint') {
    return `bigint ${value.toString()}`;
  }
  if (typeof value === 'symbol' || typeof value === 'function') {
    return typeof value;
  }
  const serialized = JSON.stringify(value);
  const maxLength = 200;
  if (serialized.length <= maxLength) {
    return `object ${serialized}`;
  }
  return `object ${serialized.slice(0, maxLength)}…`;
}

function requireMirrorRow(props: {
  row: unknown;
  rowIndex: number;
  tableName: string;
}): Record<string, unknown> {
  if (isRecord(props.row)) {
    return props.row;
  }
  throw new Error(
    `Invalid MySQL mirror row for legacy."${props.tableName}" at stream index ${props.rowIndex}: expected a non-null object, received ${mirrorRowPreview(props.row)}.`
  );
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
  const insertBatchSize = mirrorInsertBatchSize(columnNames.length);
  let batch: Record<string, unknown>[] = [];
  let totalRows = 0;

  for await (const row of props.rows) {
    batch.push(
      requireMirrorRow({
        row,
        rowIndex: totalRows + batch.length,
        tableName: props.table.tableName,
      })
    );
    if (batch.length >= insertBatchSize) {
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
