import { mysqlColumnToPostgresType } from '@/libs/legacy-sync/mysqlTypeMapping';
import type { MirrorTableDefinition } from '@/libs/legacy-sync/postgresMirrorSql';

export type MysqlQueryClient = {
  query: (
    sql: string,
    values?: readonly unknown[]
  ) => Promise<[unknown, unknown]>;
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

function rowsFromMysqlResult(rows: unknown): unknown[] {
  return Array.isArray(rows) ? rows : [];
}

function isMysqlColumnRow(row: unknown): row is MysqlColumnRow {
  return (
    isRecord(row) &&
    typeof row.columnName === 'string' &&
    typeof row.columnType === 'string' &&
    (row.isNullable === 'YES' || row.isNullable === 'NO')
  );
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
  return rowsFromMysqlResult(rows).flatMap((row) =>
    isRecord(row) && typeof row.tableName === 'string' ? [row.tableName] : []
  );
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
  return mysqlColumnsToMirrorTable(
    props.tableName,
    rowsFromMysqlResult(rows).filter(isMysqlColumnRow)
  );
}
