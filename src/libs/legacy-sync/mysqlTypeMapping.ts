const TEXT_TYPES = new Set(['text', 'mediumtext', 'longtext']);
const DOUBLE_PRECISION_TYPES = new Set(['float', 'double']);

function mapLengthType(props: {
  normalized: string;
  postgresType: 'char' | 'varchar';
}): string | null {
  const match = props.normalized.match(
    new RegExp(`^${props.postgresType}\\((\\d+)\\)`, 'u')
  );
  return match ? `${props.postgresType}(${match[1]})` : null;
}

function mapIntegerType(normalized: string): string | null {
  if (normalized.startsWith('bigint') && normalized.includes('unsigned')) {
    return 'numeric(20,0)';
  }
  if (normalized.startsWith('bigint')) {
    return 'bigint';
  }
  if (normalized.startsWith('int') && normalized.includes('unsigned')) {
    return 'bigint';
  }
  if (normalized.startsWith('smallint')) {
    return 'integer';
  }
  if (normalized.startsWith('tinyint')) {
    return 'smallint';
  }
  return normalized.startsWith('int') ? 'integer' : null;
}

export function mysqlColumnToPostgresType(columnType: string): string {
  const normalized = columnType.trim().toLowerCase();
  const lengthType =
    mapLengthType({ normalized, postgresType: 'varchar' }) ??
    mapLengthType({ normalized, postgresType: 'char' });
  if (lengthType) {
    return lengthType;
  }
  const decimalMatch = normalized.match(/^decimal\((\d+),(\d+)\)/u);
  if (decimalMatch) {
    return `numeric(${decimalMatch[1]},${decimalMatch[2]})`;
  }
  const integerType = mapIntegerType(normalized);
  if (integerType) {
    return integerType;
  }
  if (normalized === 'date') {
    return 'date';
  }
  const timeMatch = /^time(?:\((\d+)\))?$/u.exec(normalized);
  if (timeMatch) {
    return timeMatch[1] ? `time(${timeMatch[1]})` : 'time';
  }
  const timestampMatch =
    /^timestamp(?:\((\d+)\))?$/u.exec(normalized) ??
    /^datetime(?:\((\d+)\))?$/u.exec(normalized);
  if (timestampMatch) {
    return timestampMatch[1] ? `timestamp(${timestampMatch[1]})` : 'timestamp';
  }
  if (TEXT_TYPES.has(normalized)) {
    return 'text';
  }
  if (DOUBLE_PRECISION_TYPES.has(normalized)) {
    return 'double precision';
  }
  if (normalized.startsWith('blob') || normalized.endsWith('blob')) {
    return 'bytea';
  }
  return 'text';
}
