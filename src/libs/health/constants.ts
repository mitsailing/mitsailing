export const healthNoStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
} as const;

export const healthTimeoutMs = 1500;

// Defense-in-depth for the readiness `SELECT 1` check.
// This ensures a hung Postgres can’t monopolize a Prisma pool connection.
export const healthPostgresStatementTimeoutMs = 1000;
