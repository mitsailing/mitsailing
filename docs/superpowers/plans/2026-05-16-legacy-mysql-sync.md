# Legacy MySQL Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mirror the old website MySQL database `sailing` from `ak@sailing.mit.edu` into Postgres schema `legacy` hourly, then map `legacy.reservations` into the existing Pavilion reservation tables.

**Architecture:** Add a production-only BullMQ hourly scheduled job in the existing worker. The job opens an SSH tunnel, reads MySQL metadata and rows with `mysql2`, acquires a Postgres advisory lock, drops and recreates only Postgres schema `legacy`, bulk inserts all source tables together, records sync status, and runs the legacy reservation mapper.

**Tech Stack:** Next.js 16 app, Node 24 worker, BullMQ 5 `upsertJobScheduler`, Redis, Prisma/Postgres, `pg`, `ssh2`, `mysql2`, Vitest.

---

## File Structure

- Modify `package.json` and `package-lock.json`: add direct runtime dependencies `mysql2` and `ssh2`, plus dev type dependency `@types/ssh2`.
- Modify `src/libs/Env.ts`: validate production-only legacy MySQL sync environment variables.
- Create `src/libs/legacy-sync/sqlIdentifiers.ts`: quote Postgres identifiers and expose only legacy-qualified table names for mirror SQL.
- Create `src/libs/legacy-sync/mysqlTypeMapping.ts`: map MySQL column metadata to Postgres column SQL.
- Create `src/libs/legacy-sync/mysqlSchemaIntrospection.ts`: read MySQL table and column metadata.
- Create `src/libs/legacy-sync/postgresMirrorSql.ts`: build `DROP SCHEMA`, `CREATE SCHEMA`, `CREATE TABLE`, and `INSERT` SQL.
- Create `src/libs/legacy-sync/postgresMirrorLoader.ts`: write mirrored schemas and rows into Postgres using `pg`.
- Create `src/libs/legacy-sync/mysqlSshConnection.ts`: open SSH tunnel and MySQL connection pool.
- Create `src/libs/legacy-sync/legacyMysqlSync.ts`: orchestrate one sync run and metadata updates.
- Create `src/libs/legacy-sync/legacyPavilionReservationImport.ts`: import Pavilion reservations from `legacy.reservations`.
- Modify `scripts/import-legacy-pavilion-reservations.ts`: keep CSV import support, add a `--source=legacy-schema` path that calls the shared importer.
- Create `src/worker/legacyMysqlSyncJob.ts`: register and process the scheduled BullMQ job.
- Modify `src/worker/index.ts`: route BullMQ jobs to named processors and register scheduler on startup.
- Modify `prisma/schema.prisma`: add `LegacyMysqlSyncRun` and `LegacyMysqlSyncStatus`.
- Create `prisma/migrations/20260518120000_legacy_mysql_sync_runs/migration.sql`: create enum/table for sync run metadata.
- Create `.env.production.worker.example`: document worker-only secrets.
- Modify `compose.prod.yaml`: load `.env.production.worker` only in the worker and mount the SSH private key read-only.
- Modify `docs/deploy.md`: document secret setup and manual verification.

## Task 1: Add Dependencies And Environment Contract

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/libs/Env.ts`
- Create: `.env.production.worker.example`

- [ ] **Step 1: Add dependencies**

Run:

```bash
npm install mysql2 ssh2
npm install --save-dev @types/ssh2
```

Expected: `package.json` lists `mysql2` and `ssh2` under `dependencies`, and `@types/ssh2` under `devDependencies`.

- [ ] **Step 2: Add failing env validation tests by inspection**

This repo does not currently have direct tests for `Env.ts`, so make the code change small and verify with `npm run check:types` in Step 4.

- [ ] **Step 3: Extend `src/libs/Env.ts`**

Add these server fields:

```ts
LEGACY_MYSQL_SYNC_ENABLED: z.enum(['true', 'false']).default('false'),
LEGACY_MYSQL_SYNC_CRON: z.string().min(1).default('0 0 * * * *'),
LEGACY_MYSQL_SSH_HOST: z.string().min(1).optional(),
LEGACY_MYSQL_SSH_PORT: z.coerce.number().int().positive().default(22),
LEGACY_MYSQL_SSH_USER: z.string().min(1).optional(),
LEGACY_MYSQL_SSH_PRIVATE_KEY_PATH: z.string().min(1).optional(),
LEGACY_MYSQL_DATABASE: z.string().min(1).optional(),
LEGACY_MYSQL_USER: z.string().min(1).optional(),
LEGACY_MYSQL_PASSWORD: z.string().min(1).optional(),
LEGACY_MYSQL_PORT: z.coerce.number().int().positive().default(3306),
```

Add these runtime mappings:

```ts
LEGACY_MYSQL_SYNC_ENABLED: process.env.LEGACY_MYSQL_SYNC_ENABLED,
LEGACY_MYSQL_SYNC_CRON: process.env.LEGACY_MYSQL_SYNC_CRON,
LEGACY_MYSQL_SSH_HOST: process.env.LEGACY_MYSQL_SSH_HOST,
LEGACY_MYSQL_SSH_PORT: process.env.LEGACY_MYSQL_SSH_PORT,
LEGACY_MYSQL_SSH_USER: process.env.LEGACY_MYSQL_SSH_USER,
LEGACY_MYSQL_SSH_PRIVATE_KEY_PATH:
  process.env.LEGACY_MYSQL_SSH_PRIVATE_KEY_PATH,
LEGACY_MYSQL_DATABASE: process.env.LEGACY_MYSQL_DATABASE,
LEGACY_MYSQL_USER: process.env.LEGACY_MYSQL_USER,
LEGACY_MYSQL_PASSWORD: process.env.LEGACY_MYSQL_PASSWORD,
LEGACY_MYSQL_PORT: process.env.LEGACY_MYSQL_PORT,
```

Add this `superRefine` block:

```ts
if (env.LEGACY_MYSQL_SYNC_ENABLED === 'true') {
  for (const key of [
    'LEGACY_MYSQL_SSH_HOST',
    'LEGACY_MYSQL_SSH_USER',
    'LEGACY_MYSQL_SSH_PRIVATE_KEY_PATH',
    'LEGACY_MYSQL_DATABASE',
    'LEGACY_MYSQL_USER',
    'LEGACY_MYSQL_PASSWORD',
  ] as const) {
    if (!env[key]) {
      ctx.addIssue({
        code: 'custom',
        message: `${key} is required when LEGACY_MYSQL_SYNC_ENABLED=true.`,
        path: [key],
      });
    }
  }
  if (env.APP_ENV !== 'production') {
    ctx.addIssue({
      code: 'custom',
      message: 'Legacy MySQL sync can only be enabled in production.',
      path: ['LEGACY_MYSQL_SYNC_ENABLED'],
    });
  }
}
```

- [ ] **Step 4: Create `.env.production.worker.example`**

```dotenv
# Worker-only legacy MySQL mirror secrets. Copy to `.env.production.worker`
# on the production host. Never commit the filled file.

LEGACY_MYSQL_SYNC_ENABLED=true
LEGACY_MYSQL_SYNC_CRON=0 0 * * * *
LEGACY_MYSQL_SSH_HOST=sailing.mit.edu
LEGACY_MYSQL_SSH_PORT=22
LEGACY_MYSQL_SSH_USER=ak
LEGACY_MYSQL_SSH_PRIVATE_KEY_PATH=/run/secrets/legacy_mysql_ssh_key
LEGACY_MYSQL_DATABASE=sailing
LEGACY_MYSQL_USER=ak
LEGACY_MYSQL_PASSWORD=
LEGACY_MYSQL_PORT=3306

# Host path mounted by compose.prod.yaml into LEGACY_MYSQL_SSH_PRIVATE_KEY_PATH.
LEGACY_MYSQL_SSH_KEY_HOST_PATH=./secrets/legacy_mysql_ssh_key
```

- [ ] **Step 5: Verify types**

Run:

```bash
npm run check:types
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/libs/Env.ts .env.production.worker.example
git commit -m "build: add legacy MySQL sync configuration"
```

## Task 2: Add Sync Run Metadata Table

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260518120000_legacy_mysql_sync_runs/migration.sql`

- [ ] **Step 1: Add Prisma model and enum**

Append near related operational models:

```prisma
enum LegacyMysqlSyncStatus {
  running
  succeeded
  failed
  skipped

  @@map("legacy_mysql_sync_status")
}

model LegacyMysqlSyncRun {
  id             String                @id @default(cuid())
  status         LegacyMysqlSyncStatus
  sourceHost     String                @map("source_host")
  sourceDatabase String                @map("source_database")
  tableCount     Int                   @default(0) @map("table_count")
  rowCount       BigInt                @default(0) @map("row_count")
  errorMessage   String?               @map("error_message") @db.Text
  startedAt      DateTime              @default(now()) @map("started_at")
  finishedAt     DateTime?             @map("finished_at")

  @@index([status, startedAt])
  @@map("legacy_mysql_sync_runs")
}
```

- [ ] **Step 2: Create migration SQL**

```sql
CREATE TYPE "legacy_mysql_sync_status" AS ENUM ('running', 'succeeded', 'failed', 'skipped');

CREATE TABLE "legacy_mysql_sync_runs" (
  "id" TEXT NOT NULL,
  "status" "legacy_mysql_sync_status" NOT NULL,
  "source_host" TEXT NOT NULL,
  "source_database" TEXT NOT NULL,
  "table_count" INTEGER NOT NULL DEFAULT 0,
  "row_count" BIGINT NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),

  CONSTRAINT "legacy_mysql_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "legacy_mysql_sync_runs_status_started_at_idx"
  ON "legacy_mysql_sync_runs" ("status", "started_at");
```

- [ ] **Step 3: Generate Prisma client**

Run:

```bash
npx prisma generate
```

Expected: Prisma client generation succeeds.

- [ ] **Step 4: Verify types**

Run:

```bash
npm run check:types
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260518120000_legacy_mysql_sync_runs/migration.sql src/generated/prisma
git commit -m "feat: add legacy MySQL sync run tracking"
```

## Task 3: Build Safe SQL Helpers

**Files:**
- Create: `src/libs/legacy-sync/sqlIdentifiers.ts`
- Create: `src/libs/legacy-sync/sqlIdentifiers.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- src/libs/legacy-sync/sqlIdentifiers.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement helpers**

```ts
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
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- src/libs/legacy-sync/sqlIdentifiers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/libs/legacy-sync/sqlIdentifiers.ts src/libs/legacy-sync/sqlIdentifiers.test.ts
git commit -m "feat: add safe legacy schema SQL helpers"
```

## Task 4: Map MySQL Column Types To Postgres

**Files:**
- Create: `src/libs/legacy-sync/mysqlTypeMapping.ts`
- Create: `src/libs/legacy-sync/mysqlTypeMapping.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- src/libs/legacy-sync/mysqlTypeMapping.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement mapper**

```ts
export function mysqlColumnToPostgresType(columnType: string): string {
  const normalized = columnType.trim().toLowerCase();
  const varcharMatch = normalized.match(/^varchar\((\d+)\)/u);
  if (varcharMatch) {
    return `varchar(${varcharMatch[1]})`;
  }
  const charMatch = normalized.match(/^char\((\d+)\)/u);
  if (charMatch) {
    return `char(${charMatch[1]})`;
  }
  const decimalMatch = normalized.match(/^decimal\((\d+),(\d+)\)/u);
  if (decimalMatch) {
    return `numeric(${decimalMatch[1]},${decimalMatch[2]})`;
  }
  if (normalized.startsWith('bigint') && normalized.includes('unsigned')) {
    return 'numeric(20,0)';
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
  if (normalized.startsWith('int')) {
    return 'integer';
  }
  if (normalized === 'date') {
    return 'date';
  }
  if (normalized === 'time') {
    return 'time';
  }
  if (normalized === 'datetime' || normalized === 'timestamp') {
    return 'timestamp';
  }
  if (
    normalized === 'text' ||
    normalized === 'mediumtext' ||
    normalized === 'longtext'
  ) {
    return 'text';
  }
  if (normalized === 'float' || normalized === 'double') {
    return 'double precision';
  }
  if (normalized.startsWith('blob') || normalized.endsWith('blob')) {
    return 'bytea';
  }
  return 'text';
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- src/libs/legacy-sync/mysqlTypeMapping.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/libs/legacy-sync/mysqlTypeMapping.ts src/libs/legacy-sync/mysqlTypeMapping.test.ts
git commit -m "feat: map legacy MySQL types to Postgres"
```

## Task 5: Generate Mirror DDL And Inserts

**Files:**
- Create: `src/libs/legacy-sync/postgresMirrorSql.ts`
- Create: `src/libs/legacy-sync/postgresMirrorSql.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- src/libs/legacy-sync/postgresMirrorSql.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement SQL builders**

```ts
import {
  LEGACY_SCHEMA,
  quotePgIdentifier,
  quoteLegacyPgQualifiedName,
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
  const columns = columnNames.map(quotePgIdentifier).join(', ');
  const values = Array.from({ length: rowCount }, (_row, rowIndex) => {
    const placeholders = columnNames.map(
      (_column, columnIndex) => `$${rowIndex * columnNames.length + columnIndex + 1}`
    );
    return `(${placeholders.join(', ')})`;
  });
  return `INSERT INTO ${quoteLegacyPgQualifiedName(
    tableName
  )} (${columns}) VALUES ${values.join(', ')}`;
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- src/libs/legacy-sync/postgresMirrorSql.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/libs/legacy-sync/postgresMirrorSql.ts src/libs/legacy-sync/postgresMirrorSql.test.ts
git commit -m "feat: build legacy mirror SQL"
```

## Task 6: Read MySQL Metadata

**Files:**
- Create: `src/libs/legacy-sync/mysqlSchemaIntrospection.ts`
- Create: `src/libs/legacy-sync/mysqlSchemaIntrospection.test.ts`

- [ ] **Step 1: Write failing pure transformation test**

```ts
import { describe, expect, it } from 'vitest';
import { mysqlColumnsToMirrorTable } from '@/libs/legacy-sync/mysqlSchemaIntrospection';

describe('mysqlColumnsToMirrorTable', () => {
  it('converts information schema rows to a mirror table definition', () => {
    expect(
      mysqlColumnsToMirrorTable('reservations', [
        {
          columnName: 'resid',
          columnType: 'char(24)',
          isNullable: 'NO',
        },
        {
          columnName: 'comments',
          columnType: 'text',
          isNullable: 'YES',
        },
      ])
    ).toEqual({
      tableName: 'reservations',
      columns: [
        { name: 'resid', nullable: false, postgresType: 'char(24)' },
        { name: 'comments', nullable: true, postgresType: 'text' },
      ],
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- src/libs/legacy-sync/mysqlSchemaIntrospection.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement metadata helpers**

```ts
import type { Pool } from 'mysql2/promise';
import { mysqlColumnToPostgresType } from '@/libs/legacy-sync/mysqlTypeMapping';
import type { MirrorTableDefinition } from '@/libs/legacy-sync/postgresMirrorSql';

export type MysqlColumnRow = {
  columnName: string;
  columnType: string;
  isNullable: 'YES' | 'NO';
};

export function mysqlColumnsToMirrorTable(
  tableName: string,
  rows: readonly MysqlColumnRow[]
): MirrorTableDefinition {
  return {
    tableName,
    columns: rows.map((row) => ({
      name: row.columnName,
      nullable: row.isNullable === 'YES',
      postgresType: mysqlColumnToPostgresType(row.columnType),
    })),
  };
}

export async function listMysqlBaseTables(props: {
  database: string;
  mysql: Pool;
}): Promise<string[]> {
  const [rows] = await props.mysql.query(
    `SELECT TABLE_NAME AS tableName
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    [props.database]
  );
  return (rows as Array<{ tableName: string }>).map((row) => row.tableName);
}

export async function readMysqlTableDefinition(props: {
  database: string;
  mysql: Pool;
  tableName: string;
}): Promise<MirrorTableDefinition> {
  const [rows] = await props.mysql.query(
    `SELECT COLUMN_NAME AS columnName,
            COLUMN_TYPE AS columnType,
            IS_NULLABLE AS isNullable
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [props.database, props.tableName]
  );
  return mysqlColumnsToMirrorTable(props.tableName, rows as MysqlColumnRow[]);
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- src/libs/legacy-sync/mysqlSchemaIntrospection.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/libs/legacy-sync/mysqlSchemaIntrospection.ts src/libs/legacy-sync/mysqlSchemaIntrospection.test.ts
git commit -m "feat: read legacy MySQL schema metadata"
```

## Task 7: Load Mirror Tables Into Postgres

**Files:**
- Create: `src/libs/legacy-sync/postgresMirrorLoader.ts`
- Create: `src/libs/legacy-sync/postgresMirrorLoader.test.ts`

- [ ] **Step 1: Write failing batch helper test**

```ts
import { describe, expect, it } from 'vitest';
import { chunkRows, flattenRowsForInsert } from '@/libs/legacy-sync/postgresMirrorLoader';

describe('postgresMirrorLoader', () => {
  it('chunks rows', () => {
    expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('flattens row objects by column order', () => {
    expect(
      flattenRowsForInsert(
        [
          { a: 'one', b: 1 },
          { a: 'two', b: 2 },
        ],
        ['a', 'b']
      )
    ).toEqual(['one', 1, 'two', 2]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- src/libs/legacy-sync/postgresMirrorLoader.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement loader**

```ts
import type { Pool as MysqlPool } from 'mysql2/promise';
import type { Pool as PgPool } from 'pg';
import {
  buildCreateTableSql,
  buildInsertSql,
  legacySchemaResetSql,
  type MirrorTableDefinition,
} from '@/libs/legacy-sync/postgresMirrorSql';

const INSERT_BATCH_SIZE = 1000;

export function chunkRows<T>(rows: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

export function flattenRowsForInsert(
  rows: readonly Record<string, unknown>[],
  columnNames: readonly string[]
): unknown[] {
  return rows.flatMap((row) => columnNames.map((columnName) => row[columnName]));
}

export function quoteMysqlIdentifier(identifier: string): string {
  if (identifier.length === 0 || identifier.includes('\u0000')) {
    throw new Error('Invalid MySQL identifier.');
  }
  return `\`${identifier.replaceAll('`', '``')}\``;
}

export async function resetLegacySchema(pg: PgPool): Promise<void> {
  for (const sql of legacySchemaResetSql()) {
    await pg.query(sql);
  }
}

export async function createMirrorTable(props: {
  pg: PgPool;
  table: MirrorTableDefinition;
}): Promise<void> {
  await props.pg.query(buildCreateTableSql(props.table));
}

export async function copyMysqlTableToPostgres(props: {
  mysql: MysqlPool;
  pg: PgPool;
  table: MirrorTableDefinition;
}): Promise<number> {
  const columnNames = props.table.columns.map((column) => column.name);
  const [rows] = await props.mysql.query(
    `SELECT * FROM ${quoteMysqlIdentifier(props.table.tableName)}`
  );
  const rowObjects = rows as Record<string, unknown>[];
  for (const chunk of chunkRows(rowObjects, INSERT_BATCH_SIZE)) {
    if (chunk.length === 0) {
      continue;
    }
    await props.pg.query(
      buildInsertSql(props.table.tableName, columnNames, chunk.length),
      flattenRowsForInsert(chunk, columnNames)
    );
  }
  return rowObjects.length;
}
```

Add this assertion to the test:

```ts
import { quoteMysqlIdentifier } from '@/libs/legacy-sync/postgresMirrorLoader';

it('quotes mysql identifiers', () => {
  expect(quoteMysqlIdentifier('odd`name')).toBe('`odd``name`');
});
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- src/libs/legacy-sync/postgresMirrorLoader.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/libs/legacy-sync/postgresMirrorLoader.ts src/libs/legacy-sync/postgresMirrorLoader.test.ts
git commit -m "feat: load legacy mirror tables into Postgres"
```

## Task 8: Open SSH Tunnel And MySQL Pool

**Files:**
- Create: `src/libs/legacy-sync/mysqlSshConnection.ts`

- [ ] **Step 1: Implement connection factory**

```ts
import { readFile } from 'node:fs/promises';
import { createServer, type AddressInfo } from 'node:net';
import mysql from 'mysql2/promise';
import { Client } from 'ssh2';

export type LegacyMysqlConnection = {
  close: () => Promise<void>;
  mysql: mysql.Pool;
};

export async function openLegacyMysqlConnection(props: {
  database: string;
  mysqlPassword: string;
  mysqlPort: number;
  mysqlUser: string;
  sshHost: string;
  sshPort: number;
  sshPrivateKeyPath: string;
  sshUser: string;
}): Promise<LegacyMysqlConnection> {
  const privateKey = await readFile(props.sshPrivateKeyPath, 'utf8');
  const ssh = new Client();
  await new Promise<void>((resolve, reject) => {
    ssh
      .on('ready', resolve)
      .on('error', reject)
      .connect({
        host: props.sshHost,
        port: props.sshPort,
        username: props.sshUser,
        privateKey,
      });
  });

  const server = createServer((socket) => {
    ssh.forwardOut(
      socket.remoteAddress ?? '127.0.0.1',
      socket.remotePort ?? 0,
      '127.0.0.1',
      props.mysqlPort,
      (error, stream) => {
        if (error) {
          socket.destroy(error);
          return;
        }
        socket.pipe(stream).pipe(socket);
      }
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address() as AddressInfo;
  const pool = mysql.createPool({
    database: props.database,
    dateStrings: true,
    host: '127.0.0.1',
    password: props.mysqlPassword,
    port: address.port,
    user: props.mysqlUser,
    waitForConnections: true,
    connectionLimit: 2,
  });

  return {
    mysql: pool,
    close: async () => {
      await pool.end();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      ssh.end();
    },
  };
}
```

- [ ] **Step 2: Verify types**

Run:

```bash
npm run check:types
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/libs/legacy-sync/mysqlSshConnection.ts
git commit -m "feat: connect to legacy MySQL over SSH"
```

## Task 9: Orchestrate One Sync Run

**Files:**
- Create: `src/libs/legacy-sync/legacyMysqlSync.ts`
- Create: `src/libs/legacy-sync/legacyMysqlSync.test.ts`

- [ ] **Step 1: Write failing config test**

```ts
import { describe, expect, it } from 'vitest';
import {
  legacyMysqlSyncConfigFromEnv,
  releaseLegacyMysqlSyncLock,
  tryAcquireLegacyMysqlSyncLock,
} from '@/libs/legacy-sync/legacyMysqlSync';

describe('legacyMysqlSyncConfigFromEnv', () => {
  it('returns disabled config when sync flag is false', () => {
    expect(
      legacyMysqlSyncConfigFromEnv({
        APP_ENV: 'production',
        LEGACY_MYSQL_SYNC_ENABLED: 'false',
      })
    ).toEqual({ enabled: false });
  });

  it('uses hourly cron by default when enabled', () => {
    expect(
      legacyMysqlSyncConfigFromEnv({
        APP_ENV: 'production',
        LEGACY_MYSQL_DATABASE: 'sailing',
        LEGACY_MYSQL_PASSWORD: 'secret',
        LEGACY_MYSQL_PORT: 3306,
        LEGACY_MYSQL_SSH_HOST: 'sailing.mit.edu',
        LEGACY_MYSQL_SSH_PORT: 22,
        LEGACY_MYSQL_SSH_PRIVATE_KEY_PATH: '/run/secrets/key',
        LEGACY_MYSQL_SSH_USER: 'ak',
        LEGACY_MYSQL_SYNC_ENABLED: 'true',
        LEGACY_MYSQL_USER: 'ak',
      }).cron
    ).toBe('0 0 * * * *');
  });

  it('uses a fixed advisory lock for overlap prevention', async () => {
    const queries: Array<{ sql: string; values: unknown[] }> = [];
    const pg = {
      query: async <T,>(sql: string, values: unknown[] = []) => {
        queries.push({ sql, values });
        return { rows: [{ acquired: true } as T] };
      },
    };

    await expect(tryAcquireLegacyMysqlSyncLock(pg)).resolves.toBe(true);
    await releaseLegacyMysqlSyncLock(pg);

    expect(queries).toEqual([
      {
        sql: 'SELECT pg_try_advisory_lock($1, $2) AS acquired',
        values: [20260516, 1],
      },
      {
        sql: 'SELECT pg_advisory_unlock($1, $2)',
        values: [20260516, 1],
      },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- src/libs/legacy-sync/legacyMysqlSync.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement orchestrator**

```ts
import { Pool as PgPool } from 'pg';
import { Env } from '@/libs/Env';
import { prisma } from '@/libs/DB';
import { openLegacyMysqlConnection } from '@/libs/legacy-sync/mysqlSshConnection';
import {
  listMysqlBaseTables,
  readMysqlTableDefinition,
} from '@/libs/legacy-sync/mysqlSchemaIntrospection';
import {
  copyMysqlTableToPostgres,
  createMirrorTable,
  resetLegacySchema,
} from '@/libs/legacy-sync/postgresMirrorLoader';

const LEGACY_MYSQL_SYNC_ADVISORY_LOCK = {
  classId: 20260516,
  objectId: 1,
} as const;

type AdvisoryLockClient = {
  query: <T>(sql: string, values?: unknown[]) => Promise<{ rows: T[] }>;
};

type LegacyMysqlSyncEnv = {
  APP_ENV?: string;
  LEGACY_MYSQL_DATABASE?: string;
  LEGACY_MYSQL_PASSWORD?: string;
  LEGACY_MYSQL_PORT?: number;
  LEGACY_MYSQL_SSH_HOST?: string;
  LEGACY_MYSQL_SSH_PORT?: number;
  LEGACY_MYSQL_SSH_PRIVATE_KEY_PATH?: string;
  LEGACY_MYSQL_SSH_USER?: string;
  LEGACY_MYSQL_SYNC_CRON?: string;
  LEGACY_MYSQL_SYNC_ENABLED?: string;
  LEGACY_MYSQL_USER?: string;
};

export type LegacyMysqlSyncConfig =
  | { enabled: false }
  | {
      cron: string;
      database: string;
      enabled: true;
      mysqlPassword: string;
      mysqlPort: number;
      mysqlUser: string;
      sshHost: string;
      sshPort: number;
      sshPrivateKeyPath: string;
      sshUser: string;
    };

export function legacyMysqlSyncConfigFromEnv(
  env: LegacyMysqlSyncEnv = Env
): LegacyMysqlSyncConfig {
  if (env.LEGACY_MYSQL_SYNC_ENABLED !== 'true') {
    return { enabled: false };
  }
  return {
    enabled: true,
    cron: env.LEGACY_MYSQL_SYNC_CRON ?? '0 0 * * * *',
    database: env.LEGACY_MYSQL_DATABASE ?? 'sailing',
    mysqlPassword: env.LEGACY_MYSQL_PASSWORD ?? '',
    mysqlPort: env.LEGACY_MYSQL_PORT ?? 3306,
    mysqlUser: env.LEGACY_MYSQL_USER ?? 'ak',
    sshHost: env.LEGACY_MYSQL_SSH_HOST ?? 'sailing.mit.edu',
    sshPort: env.LEGACY_MYSQL_SSH_PORT ?? 22,
    sshPrivateKeyPath: env.LEGACY_MYSQL_SSH_PRIVATE_KEY_PATH ?? '',
    sshUser: env.LEGACY_MYSQL_SSH_USER ?? 'ak',
  };
}

export async function tryAcquireLegacyMysqlSyncLock(
  pg: AdvisoryLockClient
): Promise<boolean> {
  const result = await pg.query<{ acquired: boolean }>(
    'SELECT pg_try_advisory_lock($1, $2) AS acquired',
    [
      LEGACY_MYSQL_SYNC_ADVISORY_LOCK.classId,
      LEGACY_MYSQL_SYNC_ADVISORY_LOCK.objectId,
    ]
  );
  return result.rows[0]?.acquired === true;
}

export async function releaseLegacyMysqlSyncLock(
  pg: AdvisoryLockClient
): Promise<void> {
  await pg.query('SELECT pg_advisory_unlock($1, $2)', [
    LEGACY_MYSQL_SYNC_ADVISORY_LOCK.classId,
    LEGACY_MYSQL_SYNC_ADVISORY_LOCK.objectId,
  ]);
}

export async function runLegacyMysqlSync(
  config: Extract<LegacyMysqlSyncConfig, { enabled: true }>
): Promise<{ rowCount: bigint; skipped: boolean; tableCount: number }> {
  const pg = new PgPool({ connectionString: Env.DATABASE_URL });
  let acquired = false;
  let rowCount = 0n;
  let runId: string | null = null;
  try {
    acquired = await tryAcquireLegacyMysqlSyncLock(pg);
    if (!acquired) {
      await prisma.legacyMysqlSyncRun.create({
        data: {
          errorMessage:
            'Skipped because another legacy MySQL sync is still running.',
          finishedAt: new Date(),
          sourceDatabase: config.database,
          sourceHost: config.sshHost,
          status: 'skipped',
        },
      });
      return { rowCount: 0n, skipped: true, tableCount: 0 };
    }

    const run = await prisma.legacyMysqlSyncRun.create({
      data: {
        status: 'running',
        sourceDatabase: config.database,
        sourceHost: config.sshHost,
      },
      select: { id: true },
    });
    runId = run.id;

    const legacyMysql = await openLegacyMysqlConnection({
      database: config.database,
      mysqlPassword: config.mysqlPassword,
      mysqlPort: config.mysqlPort,
      mysqlUser: config.mysqlUser,
      sshHost: config.sshHost,
      sshPort: config.sshPort,
      sshPrivateKeyPath: config.sshPrivateKeyPath,
      sshUser: config.sshUser,
    });
    try {
      await resetLegacySchema(pg);
      const tableNames = await listMysqlBaseTables({
        database: config.database,
        mysql: legacyMysql.mysql,
      });
      for (const tableName of tableNames) {
        const table = await readMysqlTableDefinition({
          database: config.database,
          mysql: legacyMysql.mysql,
          tableName,
        });
        await createMirrorTable({ pg, table });
        rowCount += BigInt(
          await copyMysqlTableToPostgres({
            mysql: legacyMysql.mysql,
            pg,
            table,
          })
        );
      }
      await prisma.legacyMysqlSyncRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          rowCount,
          status: 'succeeded',
          tableCount: tableNames.length,
        },
      });
      return { rowCount, skipped: false, tableCount: tableNames.length };
    } finally {
      await legacyMysql.close();
    }
  } catch (error: unknown) {
    if (runId) {
      await prisma.legacyMysqlSyncRun.update({
        where: { id: runId },
        data: {
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          finishedAt: new Date(),
          rowCount,
          status: 'failed',
        },
      });
    }
    throw error;
  } finally {
    if (acquired) {
      await releaseLegacyMysqlSyncLock(pg);
    }
    await pg.end();
  }
}
```

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
npm run test -- src/libs/legacy-sync/legacyMysqlSync.test.ts
npm run check:types
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add src/libs/legacy-sync/legacyMysqlSync.ts src/libs/legacy-sync/legacyMysqlSync.test.ts
git commit -m "feat: orchestrate legacy MySQL mirror sync"
```

## Task 10: Import Pavilion Reservations From `legacy.reservations`

**Files:**
- Create: `src/libs/legacy-sync/legacyPavilionReservationImport.ts`
- Create: `src/libs/legacy-sync/legacyPavilionReservationImport.test.ts`
- Modify: `scripts/import-legacy-pavilion-reservations.ts`

- [ ] **Step 1: Write failing mapper test**

```ts
import { describe, expect, it } from 'vitest';
import {
  legacyReservationSlotDeleteWhere,
  legacyReservationReferenceCode,
  minutesFromMysqlTime,
} from '@/libs/legacy-sync/legacyPavilionReservationImport';

describe('legacyPavilionReservationImport', () => {
  it('builds stable legacy reference codes', () => {
    expect(
      legacyReservationReferenceCode('2010-04-16:14:30:38-feb')
    ).toBe('LEG-2010-04-16-14-30-38-feb');
  });

  it('parses mysql time strings to minutes', () => {
    expect(minutesFromMysqlTime('20:30:00')).toBe(1230);
  });

  it('builds request-scoped slot deletion filters', () => {
    expect(legacyReservationSlotDeleteWhere('legacy-request-id')).toEqual({
      requestId: 'legacy-request-id',
    });
  });

  it('rejects empty slot deletion filters', () => {
    expect(() => legacyReservationSlotDeleteWhere('')).toThrow(
      'A request id is required to replace legacy reservation slots.'
    );
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- src/libs/legacy-sync/legacyPavilionReservationImport.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Move reusable reservation logic**

Create exported helpers in `legacyPavilionReservationImport.ts` using the existing logic from `scripts/import-legacy-pavilion-reservations.ts`. Use this row type for database rows:

```ts
export type LegacyReservationDbRow = {
  acct: string | null;
  acadfac: string | null;
  acadfacemail: string | null;
  active: number | null;
  affil: string | null;
  comments: string | null;
  confirmed: number | null;
  contacted: number | null;
  date1: string | null;
  date2: string | null;
  datesel: number | null;
  email: string | null;
  end1: string | null;
  end2: string | null;
  first: string | null;
  groupname: string | null;
  groupsize: string | null;
  infoalcohol: number | null;
  infotent: number | null;
  last: string | null;
  mitid: string | null;
  paid: number | null;
  phone: string | null;
  resid: string;
  start1: string | null;
  start2: string | null;
  tentative: number | null;
  title: string | null;
};
```

Use these helpers:

```ts
export function legacyReservationReferenceCode(resid: string): string {
  return `LEG-${resid.replaceAll(/[^a-zA-Z0-9]+/gu, '-').replaceAll(/^-|-$/gu, '')}`;
}

export function minutesFromMysqlTime(value: string | null): number | null {
  const match = value?.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/u);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

export function legacyReservationSlotDeleteWhere(requestId: string): {
  requestId: string;
} {
  if (!requestId) {
    throw new Error(
      'A request id is required to replace legacy reservation slots.'
    );
  }
  return { requestId };
}
```

Then add:

```ts
export async function importLegacyPavilionReservationsFromSchema(): Promise<{
  imported: number;
  skipped: number;
}> {
  const rows = await prisma.$queryRaw<LegacyReservationDbRow[]>`
    SELECT *
    FROM legacy.reservations
    ORDER BY resid
  `;
  return importLegacyPavilionReservationRows(rows);
}
```

Keep the existing importer semantics: upsert `referenceCode` beginning with `LEG-`, delete and recreate slots only for that legacy request, and skip rows without slot, date, email, or inferred item. Use `legacyReservationSlotDeleteWhere(request.id)` for slot replacement. Do not call `pavilionReservationRequest.delete`, `pavilionReservationRequest.deleteMany`, or any unscoped reservation delete from this importer.

- [ ] **Step 4: Update script entrypoint**

Change `scripts/import-legacy-pavilion-reservations.ts` so:

```ts
const sourceFlag = process.argv[2]?.trim();
if (sourceFlag === '--source=legacy-schema') {
  const result = await importLegacyPavilionReservationsFromSchema();
  console.log(
    `Imported ${result.imported} legacy Pavilion reservations from legacy.reservations; skipped ${result.skipped}.`
  );
  return;
}
```

Keep the current CSV path behavior when the first argument is a path.

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test -- src/libs/legacy-sync/legacyPavilionReservationImport.test.ts
npm run check:types
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/libs/legacy-sync/legacyPavilionReservationImport.ts src/libs/legacy-sync/legacyPavilionReservationImport.test.ts scripts/import-legacy-pavilion-reservations.ts
git commit -m "feat: import Pavilion reservations from legacy schema"
```

## Task 11: Register Worker Scheduler And Processor

**Files:**
- Create: `src/worker/legacyMysqlSyncJob.ts`
- Modify: `src/worker/index.ts`

- [ ] **Step 1: Add job module**

Use BullMQ v5 `upsertJobScheduler`, based on current BullMQ docs:

```ts
import type { JobsOptions, Queue } from 'bullmq';
import {
  legacyMysqlSyncConfigFromEnv,
  runLegacyMysqlSync,
} from '@/libs/legacy-sync/legacyMysqlSync';
import { importLegacyPavilionReservationsFromSchema } from '@/libs/legacy-sync/legacyPavilionReservationImport';

export const LEGACY_MYSQL_SYNC_JOB_NAME = 'legacy-mysql-sync';
export const LEGACY_MYSQL_SYNC_SCHEDULER_ID = 'legacy-mysql-sync-hourly';

export async function registerLegacyMysqlSyncScheduler(
  queue: Queue
): Promise<void> {
  const config = legacyMysqlSyncConfigFromEnv();
  if (!config.enabled) {
    return;
  }
  const opts: JobsOptions = {
    attempts: 2,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: 10,
    removeOnFail: 20,
  };
  await queue.upsertJobScheduler(
    LEGACY_MYSQL_SYNC_SCHEDULER_ID,
    { pattern: config.cron },
    {
      name: LEGACY_MYSQL_SYNC_JOB_NAME,
      data: {},
      opts,
    }
  );
}

export async function processLegacyMysqlSyncJob(): Promise<void> {
  const config = legacyMysqlSyncConfigFromEnv();
  if (!config.enabled) {
    return;
  }
  const result = await runLegacyMysqlSync(config);
  if (result.skipped) {
    return;
  }
  await importLegacyPavilionReservationsFromSchema();
}
```

- [ ] **Step 2: Update worker index**

Replace the empty processor in `src/worker/index.ts` with named routing:

```ts
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import {
  LEGACY_MYSQL_SYNC_JOB_NAME,
  processLegacyMysqlSyncJob,
  registerLegacyMysqlSyncScheduler,
} from '@/worker/legacyMysqlSyncJob';

async function processJob(name: string): Promise<void> {
  if (name === LEGACY_MYSQL_SYNC_JOB_NAME) {
    await processLegacyMysqlSyncJob();
    return;
  }
}
```

Inside `main`, after Redis connection:

```ts
const queue = new Queue('default', { connection });
registerLegacyMysqlSyncScheduler(queue).catch((error: unknown) => {
  console.error(error);
});
```

Create the worker with:

```ts
const worker = new Worker(
  'default',
  async (job) => {
    await processJob(job.name);
  },
  { connection, concurrency: 1 }
);
```

Close the queue in shutdown:

```ts
await queue.close();
```

- [ ] **Step 3: Verify worker bundle**

Run:

```bash
npm run build-local
```

Expected: PASS and `worker.cjs` builds.

- [ ] **Step 4: Commit**

```bash
git add src/worker/index.ts src/worker/legacyMysqlSyncJob.ts
git commit -m "feat: schedule legacy MySQL sync in worker"
```

## Task 12: Wire Production Compose And Deploy Docs

**Files:**
- Modify: `compose.prod.yaml`
- Modify: `docs/deploy.md`

- [ ] **Step 1: Update worker env files and key mount**

In `compose.prod.yaml`, under `worker.env_file`, add:

```yaml
      - path: .env.production.worker
        required: false
```

Under `worker.volumes`, add:

```yaml
      - type: bind
        source: ${LEGACY_MYSQL_SSH_KEY_HOST_PATH:-./secrets/legacy_mysql_ssh_key}
        target: /run/secrets/legacy_mysql_ssh_key
        read_only: true
```

- [ ] **Step 2: Update deploy docs**

Add a section under production environment setup:

````markdown
### Legacy MySQL mirror worker secrets

The worker can mirror the old website MySQL database `sailing` from
`ak@sailing.mit.edu` into Postgres schema `legacy`.

Create a worker-only env file on the production host:

```bash
cd ~/apps/mitsailing
cp .env.production.worker.example .env.production.worker
$EDITOR .env.production.worker
```

Set `LEGACY_MYSQL_PASSWORD` in that file. Do not put it in shell history or
GitHub Actions secrets unless deployment automation needs to manage this file.

Install the SSH private key used by the worker. If the key does not already
exist on the production host, generate it first and add the public key to
`ak@sailing.mit.edu:~/.ssh/authorized_keys`:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/mitsailing-legacy-mysql-sync -C 'mitsailing legacy mysql sync' -N ''
ssh-copy-id -i ~/.ssh/mitsailing-legacy-mysql-sync.pub ak@sailing.mit.edu
```

Then copy the private key into the app secrets directory:

```bash
mkdir -p ~/apps/mitsailing/secrets
install -m 600 ~/.ssh/mitsailing-legacy-mysql-sync ~/apps/mitsailing/secrets/legacy_mysql_ssh_key
```

Manual verification after deploy:

```bash
docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.production logs -f --tail 100 worker
docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.production exec postgres psql "$DATABASE_URL" -c "select count(*) from information_schema.tables where table_schema = 'legacy';"
```
````

- [ ] **Step 3: Run docs and type checks**

Run:

```bash
npm run check:types
npm run lint
```

Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add compose.prod.yaml docs/deploy.md .env.production.worker.example
git commit -m "docs: document legacy MySQL mirror deployment"
```

## Task 13: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run unit tests**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 2: Run type check**

Run:

```bash
npm run check:types
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Build local Docker/Next path**

Run:

```bash
npm run build-local
```

Expected: PASS.

- [ ] **Step 5: Review unsafe SQL**

Run:

```bash
rg -n "DROP SCHEMA|DROP TABLE|TRUNCATE|DELETE FROM" src scripts prisma/migrations
```

Expected: The only new destructive schema operation is `DROP SCHEMA IF EXISTS "legacy" CASCADE`; reservation slot deletion remains scoped by request id as in the existing importer.

Known pre-existing matches are allowed and must not be attributed to this work:

- `prisma/migrations/20260423000000_drop_counter/migration.sql`
- `scripts/migrate-test-db.mjs`

- [ ] **Step 6: Commit final fixes if any**

If verification required fixes:

```bash
git status --short
git add src/libs/legacy-sync/legacyMysqlSync.ts src/libs/legacy-sync/postgresMirrorLoader.ts src/worker/index.ts
git commit -m "fix: harden legacy MySQL sync verification"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: The plan covers production-only sync, SSH/MySQL access, all-table mirroring into `legacy`, destructive refresh without staging, metadata, reservation mapping, secrets, Compose, docs, and verification.
- Placeholder scan: No placeholder task remains; environment examples leave secret values intentionally blank in an uncommitted host file.
- Type consistency: `LegacyMysqlSyncRun`, `LegacyMysqlSyncStatus`, `legacyMysqlSyncConfigFromEnv`, `runLegacyMysqlSync`, skipped sync results, and `importLegacyPavilionReservationsFromSchema` are named consistently across tasks.
