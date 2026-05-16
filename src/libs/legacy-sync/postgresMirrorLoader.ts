import type { MysqlQueryClient } from '@/libs/legacy-sync/mysqlSchemaIntrospection';
import {
  buildCreateTableSql,
  buildInsertSql,
  legacySchemaResetSql,
} from '@/libs/legacy-sync/postgresMirrorSql';
import type { MirrorTableDefinition } from '@/libs/legacy-sync/postgresMirrorSql';

const INSERT_BATCH_SIZE = 1000;

export type MirrorPgClient = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
};

export function chunkRows<T>(rows: readonly T[], size: number): T[][] {
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

export function quoteMysqlIdentifier(identifier: string): string {
  if (identifier.length === 0 || identifier.includes('\u0000')) {
    throw new Error('Invalid MySQL identifier.');
  }
  return `\`${identifier.replaceAll('`', '``')}\``;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function rowObjectsFromMysqlResult(rows: unknown): Record<string, unknown>[] {
  return Array.isArray(rows) ? rows.filter(isRecord) : [];
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

export async function copyMysqlTableToPostgres(props: {
  mysql: MysqlQueryClient;
  pg: MirrorPgClient;
  table: MirrorTableDefinition;
}): Promise<number> {
  const columnNames = props.table.columns.map((column) => column.name);
  const [rows] = await props.mysql.query(
    `SELECT * FROM ${quoteMysqlIdentifier(props.table.tableName)}`
  );
  const rowObjects = rowObjectsFromMysqlResult(rows);
  for (const chunk of chunkRows(rowObjects, INSERT_BATCH_SIZE)) {
    if (chunk.length > 0) {
      await props.pg.query(
        buildInsertSql(props.table.tableName, columnNames, chunk.length),
        flattenRowsForInsert(chunk, columnNames)
      );
    }
  }
  return rowObjects.length;
}
