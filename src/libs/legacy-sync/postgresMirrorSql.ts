import {
  LEGACY_SCHEMA,
  quoteLegacyPgQualifiedName,
  quotePgIdentifier,
} from '@/libs/legacy-sync/sqlIdentifiers';

export type MirrorColumnDefinition = {
  name: string;
  nullable: boolean;
  postgresType: string;
};

export type MirrorTableDefinition = {
  columns: MirrorColumnDefinition[];
  tableName: string;
};

export function legacySchemaResetSql(): string[] {
  return [
    `DROP SCHEMA IF EXISTS ${quotePgIdentifier(LEGACY_SCHEMA)} CASCADE`,
    `CREATE SCHEMA ${quotePgIdentifier(LEGACY_SCHEMA)}`,
  ];
}

export function buildCreateTableSql(table: MirrorTableDefinition): string {
  const columns = table.columns
    .map(
      (column) =>
        `${quotePgIdentifier(column.name)} ${column.postgresType}${
          column.nullable ? '' : ' NOT NULL'
        }`
    )
    .join(', ');
  return `CREATE TABLE ${quoteLegacyPgQualifiedName(table.tableName)} (${columns})`;
}

export function buildInsertSql(
  tableName: string,
  columnNames: readonly string[],
  rowCount: number
): string {
  const columns = columnNames.map(quotePgIdentifier).join(', ');
  const values = Array.from({ length: rowCount }, (_row, rowIndex) => {
    const placeholders = columnNames.map(
      (_column, columnIndex) =>
        `$${rowIndex * columnNames.length + columnIndex + 1}`
    );
    return `(${placeholders.join(', ')})`;
  });
  return `INSERT INTO ${quoteLegacyPgQualifiedName(
    tableName
  )} (${columns}) VALUES ${values.join(', ')}`;
}
