export const LEGACY_SCHEMA = 'legacy';

export function assertLegacySchema(schema: string): typeof LEGACY_SCHEMA {
  if (schema !== LEGACY_SCHEMA) {
    throw new Error('Refusing to operate outside the legacy schema.');
  }
  return LEGACY_SCHEMA;
}

export function quotePgIdentifier(identifier: string): string {
  if (identifier.length === 0 || identifier.includes('\u0000')) {
    throw new Error('Invalid PostgreSQL identifier.');
  }
  return `"${identifier.replaceAll('"', '""')}"`;
}

export function quoteLegacyPgQualifiedName(table: string): string {
  return `${quotePgIdentifier(LEGACY_SCHEMA)}.${quotePgIdentifier(table)}`;
}
