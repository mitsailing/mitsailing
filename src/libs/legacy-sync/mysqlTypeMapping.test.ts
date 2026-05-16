import { describe, expect, it } from 'vitest';
import { mysqlColumnToPostgresType } from '@/libs/legacy-sync/mysqlTypeMapping';

describe('mysqlColumnToPostgresType', () => {
  it('maps varchar and char lengths', () => {
    expect(mysqlColumnToPostgresType('varchar(120)')).toBe('varchar(120)');
    expect(mysqlColumnToPostgresType('char(24)')).toBe('char(24)');
  });

  it('maps integer families without boolean coercion', () => {
    expect(mysqlColumnToPostgresType('tinyint(1)')).toBe('smallint');
    expect(mysqlColumnToPostgresType('int(10) unsigned')).toBe('bigint');
    expect(mysqlColumnToPostgresType('bigint(20) unsigned')).toBe(
      'numeric(20,0)'
    );
    expect(mysqlColumnToPostgresType('bigint')).toBe('bigint');
    expect(mysqlColumnToPostgresType('bigint(20)')).toBe('bigint');
  });

  it('maps temporal and text types', () => {
    expect(mysqlColumnToPostgresType('date')).toBe('date');
    expect(mysqlColumnToPostgresType('time')).toBe('time');
    expect(mysqlColumnToPostgresType('datetime')).toBe('timestamp');
    expect(mysqlColumnToPostgresType('mediumtext')).toBe('text');
  });

  it('maps decimals and floats', () => {
    expect(mysqlColumnToPostgresType('decimal(8,2) unsigned')).toBe(
      'numeric(8,2)'
    );
    expect(mysqlColumnToPostgresType('float')).toBe('double precision');
  });
});
