import { Pool as PgPool } from 'pg';
import type { PoolClient } from 'pg';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import {
  LEGACY_MYSQL_SOURCE,
  legacyMysqlHostFromEnv,
} from '@/libs/legacy-sync/mysqlConnection';

const LEGACY_IMPORT_ADVISORY_LOCK = {
  classId: 20_260_516,
  objectId: 1,
} as const;

const EMPTY_ROW_COUNT = BigInt(Number.parseInt('0', 10));

type LegacyImportAdvisoryLockClient = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
};

function isAdvisoryLockRow(row: unknown): row is { acquired: boolean } {
  return (
    typeof row === 'object' &&
    row !== null &&
    'acquired' in row &&
    typeof row.acquired === 'boolean'
  );
}

async function tryAcquireLegacyImportLock(
  pg: LegacyImportAdvisoryLockClient
): Promise<boolean> {
  const result = await pg.query(
    'SELECT pg_try_advisory_lock($1, $2) AS acquired',
    [LEGACY_IMPORT_ADVISORY_LOCK.classId, LEGACY_IMPORT_ADVISORY_LOCK.objectId]
  );
  const [row] = result.rows;
  if (!isAdvisoryLockRow(row)) {
    throw new Error(
      'Invalid advisory lock response for tryAcquireLegacyImportLock.'
    );
  }
  return row.acquired;
}

async function releaseLegacyImportLock(
  pg: LegacyImportAdvisoryLockClient
): Promise<void> {
  await pg.query('SELECT pg_advisory_unlock($1, $2)', [
    LEGACY_IMPORT_ADVISORY_LOCK.classId,
    LEGACY_IMPORT_ADVISORY_LOCK.objectId,
  ]);
}

export type LegacyImportRunResult<T> =
  | { readonly result: T; readonly skipped: false }
  | { readonly skipped: true };

/**
 * Runs a legacy import under the Postgres advisory lock and audit table.
 *
 * @param props - Import callback, audit metadata, and lock options
 * @returns Imported rows or a skipped outcome when the advisory lock is held
 */
export async function runLegacyImportWithAudit<T>(props: {
  importRows: () => Promise<T>;
  recordImportedRows?: (result: T) => { rowCount: bigint; tableCount: number };
  sourceHost?: string;
  useAdvisoryLock?: boolean;
}): Promise<LegacyImportRunResult<T>> {
  const sourceHost = props.sourceHost ?? legacyMysqlHostFromEnv();
  const useAdvisoryLock = props.useAdvisoryLock ?? Env.APP_ENV === 'production';
  const pgPool = useAdvisoryLock
    ? new PgPool({ connectionString: Env.DATABASE_URL })
    : null;
  const pg: PoolClient | null = pgPool ? await pgPool.connect() : null;
  let acquired = false;
  let runId: string | null = null;

  try {
    if (pg !== null) {
      acquired = await tryAcquireLegacyImportLock(pg);
      if (!acquired) {
        await prisma.legacyMysqlSyncRun.create({
          data: {
            errorMessage:
              'Skipped because another legacy import is still running.',
            finishedAt: new Date(),
            sourceDatabase: LEGACY_MYSQL_SOURCE.database,
            sourceHost,
            status: 'skipped',
          },
        });
        return { skipped: true };
      }
    }

    const run = await prisma.legacyMysqlSyncRun.create({
      data: {
        sourceDatabase: LEGACY_MYSQL_SOURCE.database,
        sourceHost,
        status: 'running',
      },
      select: { id: true },
    });
    runId = run.id;

    const result = await props.importRows();
    const metrics = props.recordImportedRows?.(result) ?? {
      rowCount: EMPTY_ROW_COUNT,
      tableCount: 0,
    };

    await prisma.legacyMysqlSyncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        rowCount: metrics.rowCount,
        status: 'succeeded',
        tableCount: metrics.tableCount,
      },
    });

    return { result, skipped: false };
  } catch (error: unknown) {
    if (runId !== null) {
      try {
        await prisma.legacyMysqlSyncRun.update({
          where: { id: runId },
          data: {
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error',
            finishedAt: new Date(),
            status: 'failed',
          },
        });
      } catch {
        // Prefer the original import failure over a secondary audit-write error.
      }
    }
    throw error;
  } finally {
    if (pg !== null && acquired) {
      await releaseLegacyImportLock(pg);
    }
    pg?.release();
    await pgPool?.end();
  }
}
