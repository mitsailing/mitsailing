import { describe, expect, it } from 'vitest';
import {
  buildCreateTableSql,
  buildInsertSql,
  legacySchemaResetSql,
} from '@/libs/legacy-sync/postgresMirrorSql';

describe('postgresMirrorSql', () => {
  it('builds reset SQL only for legacy schema', () => {
    expect(legacySchemaResetSql()).toEqual([
      'DROP SCHEMA IF EXISTS "legacy" CASCADE',
      'CREATE SCHEMA "legacy"',
    ]);
  });

  it('builds create table SQL', () => {
    expect(
      buildCreateTableSql({
        tableName: 'reservations',
        columns: [
          { name: 'resid', postgresType: 'char(24)', nullable: false },
          { name: 'comments', postgresType: 'text', nullable: true },
        ],
      })
    ).toBe(
      'CREATE TABLE "legacy"."reservations" ("resid" char(24) NOT NULL, "comments" text)'
    );
  });

  it('builds parameterized inserts', () => {
    expect(buildInsertSql('reservations', ['resid', 'comments'], 2)).toBe(
      'INSERT INTO "legacy"."reservations" ("resid", "comments") VALUES ($1, $2), ($3, $4)'
    );
  });

  it('rejects invalid buildInsertSql inputs before quoting', () => {
    expect(() => buildInsertSql('', ['id'], 1)).toThrow(
      'tableName must be a non-empty string'
    );
    expect(() => buildInsertSql('t', [], 1)).toThrow(
      'columnNames must be non-empty'
    );
    expect(() => buildInsertSql('t', ['id'], 0)).toThrow(
      'rowCount must be > 0'
    );
    expect(() => buildInsertSql('t', ['id'], -1)).toThrow(
      'rowCount must be > 0'
    );
    expect(() => buildInsertSql('t', ['id'], 1.5)).toThrow(
      'rowCount must be > 0'
    );
  });

  it('does not generate destructive SQL for public or arbitrary schemas', () => {
    const generatedSql = [
      ...legacySchemaResetSql(),
      buildCreateTableSql({
        tableName: 'members',
        columns: [{ name: 'record', postgresType: 'bigint', nullable: false }],
      }),
      buildInsertSql('members', ['record'], 1),
    ].join('\n');

    expect(generatedSql).toContain('DROP SCHEMA IF EXISTS "legacy" CASCADE');
    expect(generatedSql).not.toContain('DROP SCHEMA IF EXISTS "public"');
    expect(generatedSql).not.toContain('DROP SCHEMA "public"');
    expect(generatedSql).not.toContain('TRUNCATE');
    expect(generatedSql).not.toContain('DROP TABLE');
    expect(generatedSql).not.toContain('legacy_backup');
  });
});
