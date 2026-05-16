import { Pool as PgPool } from 'pg';
import type { PoolClient } from 'pg';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import {
  LEGACY_MYSQL_SOURCE,
  openLegacyMysqlConnection,
  streamLegacyMysqlTableRows,
} from '@/libs/legacy-sync/mysqlConnection';
import {
  listMysqlBaseTables,
  readMysqlTableDefinition,
} from '@/libs/legacy-sync/mysqlSchemaIntrospection';
import {
  copyMysqlTableToPostgres,
  createMirrorTable,
  resetLegacySchema,
} from '@/libs/legacy-sync/postgresMirrorLoader';
import type { MirrorTableDefinition } from '@/libs/legacy-sync/postgresMirrorSql';

const LEGACY_MYSQL_SYNC_ADVISORY_LOCK = {
  classId: 20_260_516,
  objectId: 1,
} as const;

const EMPTY_ROW_COUNT = BigInt(Number.parseInt('0', 10));

export type AdvisoryLockClient = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
};

export type MirrorTransactionClient = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
};

type LegacyMysqlSyncEnv = {
  APP_ENV?: string;
  LEGACY_MYSQL_PASSWORD?: string;
  LEGACY_MYSQL_SYNC_CRON?: string;
  LEGACY_MYSQL_SYNC_ENABLED?: string;
};

export type LegacyMysqlSyncConfig =
  | { enabled: false }
  | {
      cron: string;
      database: typeof LEGACY_MYSQL_SOURCE.database;
      enabled: true;
      mysqlPassword: string;
      sourceHost: typeof LEGACY_MYSQL_SOURCE.host;
    };

function isAdvisoryLockRow(row: unknown): row is { acquired: boolean } {
  return (
    typeof row === 'object' &&
    row !== null &&
    'acquired' in row &&
    typeof row.acquired === 'boolean'
  );
}

export function legacyMysqlSyncConfigFromEnv(
  env: LegacyMysqlSyncEnv = Env
): LegacyMysqlSyncConfig {
  if (env.LEGACY_MYSQL_SYNC_ENABLED !== 'true') {
    return { enabled: false };
  }
  if (env.LEGACY_MYSQL_PASSWORD === undefined) {
    throw new Error(
      'LEGACY_MYSQL_PASSWORD is required when legacy sync is enabled.'
    );
  }
  return {
    enabled: true,
    cron: env.LEGACY_MYSQL_SYNC_CRON ?? '0 0 * * * *',
    database: LEGACY_MYSQL_SOURCE.database,
    mysqlPassword: env.LEGACY_MYSQL_PASSWORD,
    sourceHost: LEGACY_MYSQL_SOURCE.host,
  };
}

export async function tryAcquireLegacyMysqlSyncLock(
  pg: AdvisoryLockClient
): Promise<boolean> {
  const result = await pg.query(
    'SELECT pg_try_advisory_lock($1, $2) AS acquired',
    [
      LEGACY_MYSQL_SYNC_ADVISORY_LOCK.classId,
      LEGACY_MYSQL_SYNC_ADVISORY_LOCK.objectId,
    ]
  );
  const [row] = result.rows;
  return isAdvisoryLockRow(row) && row.acquired;
}

export async function releaseLegacyMysqlSyncLock(
  pg: AdvisoryLockClient
): Promise<void> {
  await pg.query('SELECT pg_advisory_unlock($1, $2)', [
    LEGACY_MYSQL_SYNC_ADVISORY_LOCK.classId,
    LEGACY_MYSQL_SYNC_ADVISORY_LOCK.objectId,
  ]);
}

export async function runLegacyMirrorTransaction(props: {
  load: () => Promise<{ rowCount: bigint; tableCount: number }>;
  pg: MirrorTransactionClient;
}): Promise<{ rowCount: bigint; tableCount: number }> {
  await props.pg.query('BEGIN');
  try {
    const result = await props.load();
    await props.pg.query('COMMIT');
    return result;
  } catch (error: unknown) {
    await props.pg.query('ROLLBACK');
    throw error;
  }
}

export async function runLegacyMysqlSync(
  config: Extract<LegacyMysqlSyncConfig, { enabled: true }>
): Promise<{ rowCount: bigint; skipped: boolean; tableCount: number }> {
  const pgPool = new PgPool({ connectionString: Env.DATABASE_URL });
  const pg: PoolClient = await pgPool.connect();
  let acquired = false;
  let rowCount = EMPTY_ROW_COUNT;
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
          sourceHost: config.sourceHost,
          status: 'skipped',
        },
      });
      return { rowCount: EMPTY_ROW_COUNT, skipped: true, tableCount: 0 };
    }

    const run = await prisma.legacyMysqlSyncRun.create({
      data: {
        status: 'running',
        sourceDatabase: config.database,
        sourceHost: config.sourceHost,
      },
      select: { id: true },
    });
    runId = run.id;

    const legacyMysql = openLegacyMysqlConnection({
      password: config.mysqlPassword,
    });
    try {
      const tableNames = await listMysqlBaseTables({
        database: config.database,
        mysql: legacyMysql.mysql,
      });
      const tables: MirrorTableDefinition[] = [];
      for (const tableName of tableNames) {
        tables.push(
          await readMysqlTableDefinition({
            database: config.database,
            mysql: legacyMysql.mysql,
            tableName,
          })
        );
      }
      const mirrorResult = await runLegacyMirrorTransaction({
        pg,
        load: async () => {
          await resetLegacySchema(pg);
          let loadedRows = EMPTY_ROW_COUNT;
          for (const table of tables) {
            await createMirrorTable({ pg, table });
            loadedRows += BigInt(
              await copyMysqlTableToPostgres({
                pg,
                rows: streamLegacyMysqlTableRows(
                  legacyMysql.mysql,
                  table.tableName
                ),
                table,
              })
            );
          }
          return { rowCount: loadedRows, tableCount: tables.length };
        },
      });
      ({ rowCount } = mirrorResult);
      await prisma.legacyMysqlSyncRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          rowCount,
          status: 'succeeded',
          tableCount: mirrorResult.tableCount,
        },
      });
      return {
        rowCount,
        skipped: false,
        tableCount: mirrorResult.tableCount,
      };
    } finally {
      await legacyMysql.close();
    }
  } catch (error: unknown) {
    if (runId !== null) {
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
    pg.release();
    await pgPool.end();
  }
}
