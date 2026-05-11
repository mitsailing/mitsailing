import { PrismaPg } from '@prisma/adapter-pg';
import { withAccelerate } from '@prisma/extension-accelerate';
import { Pool } from 'pg';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaClient } from '@/generated/prisma/client';
import { Env } from './Env';

declare global {
  var cachedPool: Pool | undefined;
  var cachedPrisma: PrismaClient | undefined;
}

function isAccelerateDatabaseUrl(url: string): boolean {
  return url.startsWith('prisma+postgres://') || url.startsWith('prisma://');
}

function createPrisma(): PrismaClient {
  const log: Prisma.LogLevel[] =
    Env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'];

  if (isAccelerateDatabaseUrl(Env.DATABASE_URL)) {
    const client = new PrismaClient({
      accelerateUrl: Env.DATABASE_URL,
      log,
    });

    // Accelerate extends the generated client with the same model surface we rely on.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Accelerate wraps the client; double cast matches Prisma docs for prisma+ URLs
    return client.$extends(withAccelerate()) as unknown as PrismaClient;
  }

  const pool =
    globalThis.cachedPool ??
    new Pool({
      connectionString: Env.DATABASE_URL,
    });

  globalThis.cachedPool = pool;

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log,
  });
}

function hasGeneratedModelSurface(client: PrismaClient): boolean {
  return 'userAudit' in client;
}

const { cachedPrisma } = globalThis;
const prisma =
  cachedPrisma && hasGeneratedModelSurface(cachedPrisma)
    ? cachedPrisma
    : createPrisma();

globalThis.cachedPrisma = prisma;

export { prisma };
