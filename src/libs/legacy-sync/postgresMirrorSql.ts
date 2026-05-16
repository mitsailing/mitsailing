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
  if (typeof tableName !== 'string' || tableName.length === 0) {
    throw new Error('tableName must be a non-empty string');
  }
  if (columnNames.length === 0) {
    throw new Error('columnNames must be non-empty');
  }
  for (const [index, columnName] of columnNames.entries()) {
    if (typeof columnName !== 'string') {
      throw new TypeError(
        `columnNames[${index}] must be a string, received ${typeof columnName}`
      );
    }
  }
  if (!Number.isInteger(rowCount) || rowCount <= 0) {
    throw new RangeError('rowCount must be > 0');
  }

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
