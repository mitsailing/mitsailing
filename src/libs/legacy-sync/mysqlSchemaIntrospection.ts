import { mysqlColumnToPostgresType } from '@/libs/legacy-sync/mysqlTypeMapping';
import type { MirrorTableDefinition } from '@/libs/legacy-sync/postgresMirrorSql';

export type MysqlQueryClient = {
  query: (sql: string, values?: unknown[]) => Promise<[unknown, unknown]>;
};

export type MysqlColumnRow = {
  columnName: string;
  columnType: string;
  isNullable: 'YES' | 'NO';
};

export function mysqlColumnsToMirrorTable(
  tableName: string,
  rows: readonly MysqlColumnRow[]
): MirrorTableDefinition {
  return {
    tableName,
    columns: rows.map((row) => ({
      name: row.columnName,
      nullable: row.isNullable === 'YES',
      postgresType: mysqlColumnToPostgresType(row.columnType),
    })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseMysqlQueryRows(rows: unknown, context: string): unknown[] {
  if (!Array.isArray(rows)) {
    throw new TypeError(
      `Invalid MySQL ${context}: expected query rows to be an array, received ${typeof rows}.`
    );
  }
  return rows;
}

function isMysqlTableNameRow(row: unknown): row is { tableName: string } {
  return isRecord(row) && typeof row.tableName === 'string';
}

function parseMysqlTableNameRows(rows: unknown[], context: string): string[] {
  return rows.map((row, index) => {
    if (!isMysqlTableNameRow(row)) {
      throw new Error(
        `Invalid MySQL ${context}: row at index ${index} must be an object with string tableName.`
      );
    }
    return row.tableName;
  });
}

function isMysqlColumnRow(row: unknown): row is MysqlColumnRow {
  return (
    isRecord(row) &&
    typeof row.columnName === 'string' &&
    typeof row.columnType === 'string' &&
    (row.isNullable === 'YES' || row.isNullable === 'NO')
  );
}

function parseMysqlColumnRows(
  rows: unknown[],
  context: string
): MysqlColumnRow[] {
  return rows.map((row, index) => {
    if (!isMysqlColumnRow(row)) {
      throw new Error(
        `Invalid MySQL ${context}: row at index ${index} must include string columnName, string columnType, and isNullable YES or NO.`
      );
    }
    return row;
  });
}

export async function listMysqlBaseTables(props: {
  database: string;
  mysql: MysqlQueryClient;
}): Promise<string[]> {
  const [rows] = await props.mysql.query(
    `SELECT TABLE_NAME AS tableName
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    [props.database]
  );
  const context = 'information_schema.TABLES';
  return parseMysqlTableNameRows(parseMysqlQueryRows(rows, context), context);
}

export async function readMysqlTableDefinition(props: {
  database: string;
  mysql: MysqlQueryClient;
  tableName: string;
}): Promise<MirrorTableDefinition> {
  const [rows] = await props.mysql.query(
    `SELECT COLUMN_NAME AS columnName,
            COLUMN_TYPE AS columnType,
            IS_NULLABLE AS isNullable
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [props.database, props.tableName]
  );
  const context = 'information_schema.COLUMNS';
  return mysqlColumnsToMirrorTable(
    props.tableName,
    parseMysqlColumnRows(parseMysqlQueryRows(rows, context), context)
  );
}
