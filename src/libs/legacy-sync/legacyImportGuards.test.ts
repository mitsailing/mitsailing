import { describe, expect, it } from 'vitest';
import { assertLocalDevDatabaseForLegacyImport } from '@/libs/legacy-sync/legacyImportGuards';

describe('assertLocalDevDatabaseForLegacyImport', () => {
  it('allows production regardless of database url', () => {
    expect(() => {
      assertLocalDevDatabaseForLegacyImport({
        APP_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:secret@prod.example.com/app',
      });
    }).not.toThrow();
  });

  it('allows local dev_db on loopback', () => {
    expect(() => {
      assertLocalDevDatabaseForLegacyImport({
        APP_ENV: 'local',
        DATABASE_URL:
          'postgresql://postgres:postgres@127.0.0.1:5432/dev_db?sslmode=disable',
      });
    }).not.toThrow();
  });

  it('rejects remote databases outside production', () => {
    expect(() => {
      assertLocalDevDatabaseForLegacyImport({
        APP_ENV: 'local',
        DATABASE_URL:
          'postgresql://postgres:secret@prod.example.com/mitsailing_prod',
      });
    }).toThrow(
      'Legacy import aborted: outside production, DATABASE_URL must target dev_db on 127.0.0.1 or localhost.'
    );
  });
});
