import { describe, expect, it } from 'vitest';
import {
  assertLegacySchema,
  LEGACY_SCHEMA,
  quoteLegacyPgQualifiedName,
  quotePgIdentifier,
} from '@/libs/legacy-sync/sqlIdentifiers';

describe('sqlIdentifiers', () => {
  it('exposes a single legacy schema constant', () => {
    expect(LEGACY_SCHEMA).toBe('legacy');
  });

  it('quotes postgres identifiers with embedded quotes', () => {
    expect(quotePgIdentifier('odd"name')).toBe('"odd""name"');
  });

  it('quotes legacy-qualified names without accepting a schema argument', () => {
    expect(quoteLegacyPgQualifiedName('reservations')).toBe(
      '"legacy"."reservations"'
    );
  });

  it('accepts legacy schema', () => {
    expect(assertLegacySchema('legacy')).toBe('legacy');
  });

  it('rejects public schema', () => {
    expect(() => assertLegacySchema('public')).toThrow(
      'Refusing to operate outside the legacy schema.'
    );
  });

  it('rejects arbitrary schema names', () => {
    expect(() => assertLegacySchema('legacy_backup')).toThrow(
      'Refusing to operate outside the legacy schema.'
    );
  });
});
