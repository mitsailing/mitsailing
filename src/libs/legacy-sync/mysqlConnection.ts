import mysql from 'mysql2/promise';
import type { Pool, PoolConnection, PoolOptions } from 'mysql2/promise';
import { quoteMysqlIdentifier } from '@/libs/legacy-sync/mysqlIdentifiers';
import { MIRROR_ROW_BATCH_SIZE } from '@/libs/legacy-sync/postgresMirrorLoader';

export const LEGACY_MYSQL_SOURCE = {
  database: 'sailing',
  host: 'sailing.pavilion.lan',
  port: 3306,
  user: 'dock_readonly',
} as const;

export type LegacyMysqlConnection = {
  close: () => Promise<void>;
  mysql: mysql.Pool;
};

export function legacyMysqlPoolOptions(password: string): PoolOptions {
  return {
    bigNumberStrings: true,
    charset: 'utf8mb4',
    connectTimeout: 10_000,
    database: LEGACY_MYSQL_SOURCE.database,
    dateStrings: true,
    enableKeepAlive: true,
    host: LEGACY_MYSQL_SOURCE.host,
    keepAliveInitialDelay: 0,
    password,
    port: LEGACY_MYSQL_SOURCE.port,
    supportBigNumbers: true,
    timezone: 'Z',
    user: LEGACY_MYSQL_SOURCE.user,
    waitForConnections: true,
    connectionLimit: 2,
  };
}

export function openLegacyMysqlConnection(props: {
  password: string;
}): LegacyMysqlConnection {
  const pool = mysql.createPool(legacyMysqlPoolOptions(props.password));

  return {
    mysql: pool,
    close: async () => {
      await pool.end();
    },
  };
}

type StreamableMysqlQuery = {
  stream: (options?: { highWaterMark?: number }) => NodeJS.ReadableStream;
};

type StreamableMysqlConnection = {
  query: (sql: string) => StreamableMysqlQuery;
};

/** Pool surface used to stream legacy MySQL table rows in tests and production. */
export type LegacyMysqlRowStreamPool = Pick<Pool, 'getConnection'>;

/**
 * mysql2/promise pools stream via the underlying non-promise `connection`.
 *
 * @param poolConnection - Dedicated connection from `pool.getConnection()`.
 * @returns Underlying connection that supports `.query().stream()`.
 */
function streamableMysqlConnection(
  poolConnection: PoolConnection
): StreamableMysqlConnection {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- mysql2 promise PoolConnection hides the streaming `.connection` field
  const record = poolConnection as unknown as Record<string, unknown>;
  const underlying = record.connection;
  if (
    typeof underlying !== 'object' ||
    underlying === null ||
    !('query' in underlying)
  ) {
    throw new Error('mysql2 streaming connection unavailable');
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- mysql2 promise layer does not type the streaming connection
  return underlying as StreamableMysqlConnection;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Streams table rows from a dedicated pool connection so large mirrors stay bounded in memory.
 *
 * @param pool - MySQL pool used to borrow a streaming connection.
 * @param tableName - Legacy source table name from introspection.
 * @yields Row objects from the legacy table.
 */
export async function* streamLegacyMysqlTableRows(
  pool: LegacyMysqlRowStreamPool,
  tableName: string
): AsyncGenerator<Record<string, unknown>> {
  const poolConnection = await pool.getConnection();
  try {
    const sql = `SELECT * FROM ${quoteMysqlIdentifier(tableName)}`;
    const rowStream = streamableMysqlConnection(poolConnection)
      .query(sql)
      .stream({ highWaterMark: MIRROR_ROW_BATCH_SIZE });

    for await (const row of rowStream) {
      if (isRecord(row)) {
        yield row;
      }
    }
  } finally {
    poolConnection.release();
  }
}
