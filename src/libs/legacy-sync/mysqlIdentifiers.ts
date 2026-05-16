/**
 * Quotes a MySQL identifier for use in static SQL (table/column names from introspection).
 *
 * @param identifier - Raw table or column name from introspection.
 * @returns Quoted identifier safe for interpolation into SQL.
 */
export function quoteMysqlIdentifier(identifier: string): string {
  if (identifier.length === 0 || identifier.includes('\u0000')) {
    throw new Error('Invalid MySQL identifier.');
  }
  return `\`${identifier.replaceAll('`', '``')}\``;
}
