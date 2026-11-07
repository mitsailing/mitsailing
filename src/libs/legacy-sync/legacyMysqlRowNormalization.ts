const MYSQL_ZERO_DATE = /^0{4}-0{2}-0{2}(?: 0{2}:0{2}:0{2}(?:\.0+)?)?$/u;

/**
 * Converts MySQL zero-date sentinels to null for downstream Postgres imports.
 *
 * @param value - Raw MySQL cell value
 * @returns Normalized value with zero dates replaced by null
 */
export function normalizeLegacyMysqlCellValue(value: unknown): unknown {
  if (typeof value === 'string' && MYSQL_ZERO_DATE.test(value.trim())) {
    return null;
  }
  return value;
}

/**
 * Coerces legacy MySQL scalar values to the string shape importers expect.
 *
 * @param value - Raw or normalized MySQL cell value
 * @returns String scalar or null when empty or zero-dated
 */
export function legacyMysqlStringScalar(value: unknown): string | null {
  const normalized = normalizeLegacyMysqlCellValue(value);
  if (normalized === null || normalized === undefined) {
    return null;
  }
  if (typeof normalized === 'string') {
    return normalized;
  }
  if (typeof normalized === 'number' || typeof normalized === 'bigint') {
    return normalized.toString();
  }
  if (typeof normalized === 'boolean') {
    return normalized ? '1' : '0';
  }
  if (normalized instanceof Buffer) {
    return normalized.toString('utf8');
  }
  return null;
}

/**
 * Normalizes every cell in a legacy MySQL row object.
 *
 * @param row - Legacy MySQL row object
 * @returns Row with zero-date cells normalized to null
 */
export function normalizeLegacyMysqlRow(
  row: Record<string, unknown>
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = normalizeLegacyMysqlCellValue(value);
  }
  return normalized;
}

/**
 * Normalizes a legacy row whose columns are imported as strings.
 *
 * @param row - Legacy MySQL row object
 * @returns Row with string scalar values for each column
 */
export function normalizeLegacyMysqlStringRow(
  row: Record<string, unknown>
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = legacyMysqlStringScalar(value);
  }
  return normalized;
}
