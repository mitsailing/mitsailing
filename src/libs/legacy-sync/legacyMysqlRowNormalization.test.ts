import { describe, expect, it } from 'vitest';
import {
  legacyMysqlStringScalar,
  normalizeLegacyMysqlCellValue,
  normalizeLegacyMysqlRow,
} from '@/libs/legacy-sync/legacyMysqlRowNormalization';

describe('normalizeLegacyMysqlCellValue', () => {
  it('maps mysql zero dates to null', () => {
    expect(normalizeLegacyMysqlCellValue('0000-00-00')).toBeNull();
    expect(normalizeLegacyMysqlCellValue('0000-00-00 00:00:00')).toBeNull();
    expect(normalizeLegacyMysqlCellValue('0000-00-00 00:00:00.000')).toBeNull();
  });

  it('preserves valid dates and other values', () => {
    expect(normalizeLegacyMysqlCellValue('2026-01-01')).toBe('2026-01-01');
    expect(normalizeLegacyMysqlCellValue('Jordan')).toBe('Jordan');
    expect(normalizeLegacyMysqlCellValue(null)).toBeNull();
  });
});

describe('normalizeLegacyMysqlRow', () => {
  it('normalizes every column in a row', () => {
    expect(
      normalizeLegacyMysqlRow({
        expire_date: '0000-00-00',
        first: 'Jordan',
        record_date: '2026-01-01 12:00:00',
      })
    ).toEqual({
      expire_date: null,
      first: 'Jordan',
      record_date: '2026-01-01 12:00:00',
    });
  });
});

describe('legacyMysqlStringScalar', () => {
  it('coerces mysql numeric scalars to strings', () => {
    expect(legacyMysqlStringScalar(1)).toBe('1');
    expect(legacyMysqlStringScalar(true)).toBe('1');
  });
});
