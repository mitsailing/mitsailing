import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';

const seedPostgresApplicationName = 'mitsailing-seed';

/**
 * DATABASE_URL for Prisma 7 seed scripts. Reads process.env after dotenv, not Env.ts.
 *
 * @returns Postgres connection string
 * @throws If DATABASE_URL is missing or empty
 */
export function seedDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error('DATABASE_URL is not set');
  }
  return url.trim();
}

/**
 * Prisma 7 seed client with its own pg Pool. Not the Next.js/worker singleton.
 *
 * @param connectionString - Postgres URL from `seedDatabaseUrl()`
 * @returns Client plus pool so callers can `$disconnect` then `pool.end()`
 */
export function createSeedPrisma(connectionString: string): {
  pool: Pool;
  prisma: PrismaClient;
} {
  const pool = new Pool({
    application_name: seedPostgresApplicationName,
    connectionString,
    connectionTimeoutMillis: 10_000,
  });
  return {
    pool,
    prisma: new PrismaClient({ adapter: new PrismaPg(pool) }),
  };
}
