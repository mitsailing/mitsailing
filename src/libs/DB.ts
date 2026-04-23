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
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- Accelerate wraps PrismaClient for prisma+postgres URLs (Prisma docs)
    return client.$extends(withAccelerate()) as unknown as PrismaClient;
  }

  const pool =
    globalThis.cachedPool ??
    new Pool({
      connectionString: Env.DATABASE_URL,
    });

  const adapter = new PrismaPg(pool);

  if (Env.NODE_ENV !== 'production') {
    globalThis.cachedPool = pool;
  }

  return new PrismaClient({
    adapter,
    log,
  });
}

const prisma = globalThis.cachedPrisma ?? createPrisma();

if (Env.NODE_ENV !== 'production') {
  globalThis.cachedPrisma = prisma;
}

export { prisma };
