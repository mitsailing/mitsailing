import mysql from 'mysql2/promise';
import type { PoolOptions } from 'mysql2/promise';

export type LegacyMysqlConnection = {
  close: () => Promise<void>;
  mysql: mysql.Pool;
};

export function legacyMysqlPoolOptionsFromUrl(mysqlUrl: string): PoolOptions {
  const url = new URL(mysqlUrl);
  return {
    charset: 'utf8mb4',
    connectTimeout: 10_000,
    database: url.pathname.slice(1),
    dateStrings: true,
    enableKeepAlive: true,
    host: url.hostname,
    keepAliveInitialDelay: 0,
    password: decodeURIComponent(url.password),
    port: url.port ? Number(url.port) : 3306,
    timezone: 'Z',
    user: decodeURIComponent(url.username),
    waitForConnections: true,
    connectionLimit: 2,
  };
}

export function openLegacyMysqlConnection(props: {
  mysqlUrl: string;
}): LegacyMysqlConnection {
  const pool = mysql.createPool(legacyMysqlPoolOptionsFromUrl(props.mysqlUrl));

  return {
    mysql: pool,
    close: async () => {
      await pool.end();
    },
  };
}
