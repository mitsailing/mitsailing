import { setTimeout as delay } from 'node:timers/promises';
import IORedis from 'ioredis';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { healthTimeoutMs } from './constants';

export type HealthCheckStatus = 'ok' | 'fail' | 'skip';

export type DependencyHealth = {
  status: HealthCheckStatus;
  required: boolean;
  latencyMs: number;
  code?: 'missing_config' | 'skipped_local' | 'timeout' | 'unreachable';
};

export type ReadinessHealthResponse = {
  status: 'ok' | 'fail';
  service: 'nextjs';
  appEnv: string;
  timestamp: string;
  latencyMs: number;
  checks: {
    postgres: DependencyHealth;
    redis: DependencyHealth;
  };
  deploymentVersion?: string;
};

type ReadinessEnv = {
  appEnv: string;
  deploymentVersion?: string;
  redisUrl?: string;
};

type ReadinessCheckers = {
  postgres: () => Promise<void>;
  redis: (redisUrl: string) => Promise<void>;
};

type ReadinessOptions = {
  env?: ReadinessEnv;
  checkers?: Partial<ReadinessCheckers>;
  timeoutMs?: number;
};

function defaultEnv(): ReadinessEnv {
  return {
    appEnv: Env.APP_ENV,
    deploymentVersion: Env.DEPLOYMENT_VERSION,
    redisUrl: Env.REDIS_URL,
  };
}

function redisIsRequired(appEnv: string): boolean {
  return appEnv === 'staging' || appEnv === 'production';
}

async function checkPostgres(): Promise<void> {
  await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
}

async function checkRedis(redisUrl: string): Promise<void> {
  const client = new IORedis(redisUrl, {
    connectTimeout: healthTimeoutMs,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });

  try {
    await client.connect();
    await client.ping();
  } finally {
    client.disconnect();
  }
}

async function timeoutFailure(
  timeoutMs: number,
  signal: AbortSignal
): Promise<never> {
  await delay(timeoutMs, undefined, { signal });
  throw new Error('health check timed out');
}

async function measureCheck(params: {
  required: boolean;
  timeoutMs: number;
  run: () => Promise<void>;
}): Promise<DependencyHealth> {
  const startedAt = performance.now();
  const timeout = new AbortController();
  try {
    await Promise.race([
      params.run(),
      timeoutFailure(params.timeoutMs, timeout.signal),
    ]);
    return {
      status: 'ok',
      required: params.required,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    return {
      status: 'fail',
      required: params.required,
      latencyMs: Math.round(performance.now() - startedAt),
      code: message.includes('timed out') ? 'timeout' : 'unreachable',
    };
  } finally {
    timeout.abort();
  }
}

function skippedRedisCheck(required: boolean): DependencyHealth {
  return {
    status: 'skip',
    required,
    latencyMs: 0,
    code: required ? 'missing_config' : 'skipped_local',
  };
}

export async function getReadinessHealth(
  options: ReadinessOptions = {}
): Promise<ReadinessHealthResponse> {
  const env = options.env ?? defaultEnv();
  const timeoutMs = options.timeoutMs ?? healthTimeoutMs;
  const checkers: ReadinessCheckers = {
    postgres: options.checkers?.postgres ?? checkPostgres,
    redis: options.checkers?.redis ?? checkRedis,
  };
  const startedAt = performance.now();
  const isRedisRequired = redisIsRequired(env.appEnv);

  const postgresPromise = measureCheck({
    required: true,
    timeoutMs,
    run: checkers.postgres,
  });
  const { redisUrl } = env;
  const redisPromise = redisUrl
    ? measureCheck({
        required: isRedisRequired,
        timeoutMs,
        run: () => checkers.redis(redisUrl),
      })
    : Promise.resolve(skippedRedisCheck(isRedisRequired));

  const [postgres, redis] = await Promise.all([postgresPromise, redisPromise]);
  const requiredChecks = [postgres, redis].filter((check) => check.required);
  const status = requiredChecks.every((check) => check.status === 'ok')
    ? 'ok'
    : 'fail';

  return {
    status,
    service: 'nextjs',
    appEnv: env.appEnv,
    timestamp: new Date().toISOString(),
    latencyMs: Math.round(performance.now() - startedAt),
    checks: { postgres, redis },
    deploymentVersion: env.deploymentVersion,
  };
}
