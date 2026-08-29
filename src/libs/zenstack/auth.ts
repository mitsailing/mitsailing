import 'server-only';
import { zenstackAdapter } from '@zenstackhq/better-auth';
import type { ClientContract } from '@zenstackhq/orm';
import { ZenStackClient } from '@zenstackhq/orm';
import { PostgresDialect } from '@zenstackhq/orm/dialects/postgres';
import { PolicyPlugin } from '@zenstackhq/plugin-policy';
import { Pool } from 'pg';
import { Env } from '@/libs/Env';
import { postgresApplicationName } from '@/libs/postgresApplicationName';
import type { AppAuthContext } from '@/libs/zenstack/authContext';
import type { SchemaType } from '../../../zenstack/schema';
import { schema } from '../../../zenstack/schema';

export type ZenStackDb = ClientContract<SchemaType>;

declare global {
  var cachedPool: Pool | undefined;
  var cachedZenStack: ZenStackDb | undefined;
  var cachedZenStackPolicy: ZenStackDb | undefined;
}

function getPool(): Pool {
  const { cachedPool } = globalThis;
  if (cachedPool) {
    return cachedPool;
  }
  const pool = new Pool({
    application_name: postgresApplicationName(),
    connectionString: Env.DATABASE_URL,
  });
  globalThis.cachedPool = pool;
  return pool;
}

function createZenStackClient(): ZenStackDb {
  return new ZenStackClient(schema, {
    dialect: new PostgresDialect({ pool: getPool() }),
  });
}

export function getAuthZenStack(): ZenStackDb {
  const cached = globalThis.cachedZenStack;
  if (cached) {
    return cached;
  }
  const client = createZenStackClient();
  globalThis.cachedZenStack = client;
  return client;
}

export function getZenStack(): ZenStackDb {
  const cached = globalThis.cachedZenStackPolicy;
  if (cached) {
    return cached;
  }
  const client = getAuthZenStack().$use(new PolicyPlugin());
  globalThis.cachedZenStackPolicy = client;
  return client;
}

export function getBetterAuthZenStackAdapter() {
  return zenstackAdapter(getAuthZenStack(), { provider: 'postgresql' });
}

export function zenstackForAuthContext(authContext: AppAuthContext) {
  return getZenStack().$setAuth(authContext);
}
