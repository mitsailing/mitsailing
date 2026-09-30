import mysql from 'mysql2/promise';
import type { PoolOptions } from 'mysql2/promise';
import { Env } from '@/libs/Env';

const LEGACY_MYSQL_DEFAULT_HOST = 'sailing.pavilion.lan';
const LEGACY_MYSQL_DEFAULT_PORT = 3306;

export const LEGACY_MYSQL_SOURCE = {
  database: 'sailing',
  host: LEGACY_MYSQL_DEFAULT_HOST,
  port: LEGACY_MYSQL_DEFAULT_PORT,
  user: 'dock_readonly',
} as const;

export type LegacyMysqlConnectionEnv = {
  LEGACY_MYSQL_HOST?: string;
  LEGACY_MYSQL_PORT?: number;
};

/**
 * Resolves the legacy MySQL host from env (tunnel override or pavilion default).
 *
 * @param env - Validated env or test override; defaults to `Env`.
 * @returns Hostname for the legacy MySQL mirror.
 */
export function legacyMysqlHostFromEnv(
  env: LegacyMysqlConnectionEnv = Env
): string {
  return env.LEGACY_MYSQL_HOST ?? LEGACY_MYSQL_DEFAULT_HOST;
}

/**
 * Resolves the legacy MySQL port from env (tunnel override or pavilion default).
 *
 * @param env - Validated env or test override; defaults to `Env`.
 * @returns TCP port for the legacy MySQL mirror.
 */
function legacyMysqlPortFromEnv(env: LegacyMysqlConnectionEnv = Env): number {
  return env.LEGACY_MYSQL_PORT ?? LEGACY_MYSQL_DEFAULT_PORT;
}

export type LegacyMysqlConnection = {
  close: () => Promise<void>;
  mysql: mysql.Pool;
};

export function legacyMysqlPoolOptions(
  password: string,
  env: LegacyMysqlConnectionEnv = Env
): PoolOptions {
  return {
    bigNumberStrings: true,
    charset: 'utf8mb4',
    connectTimeout: 10_000,
    database: LEGACY_MYSQL_SOURCE.database,
    dateStrings: true,
    enableKeepAlive: true,
    host: legacyMysqlHostFromEnv(env),
    keepAliveInitialDelay: 0,
    password,
    port: legacyMysqlPortFromEnv(env),
    supportBigNumbers: true,
    timezone: 'Z',
    user: LEGACY_MYSQL_SOURCE.user,
    waitForConnections: true,
    connectionLimit: 2,
  };
}

export function openLegacyMysqlConnection(props: {
  password: string;
  env?: LegacyMysqlConnectionEnv;
}): LegacyMysqlConnection {
  const pool = mysql.createPool(
    legacyMysqlPoolOptions(props.password, props.env)
  );

  return {
    mysql: pool,
    close: async () => {
      await pool.end();
    },
  };
}
