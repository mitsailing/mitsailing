import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import IORedis from 'ioredis';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { healthPostgresStatementTimeoutMs, healthTimeoutMs } from './constants';

export type HealthCheckStatus = 'ok' | 'fail' | 'skip';

export type DependencyHealth = {
  status: HealthCheckStatus;
  required: boolean;
  latencyMs: number;
  code?:
    | 'missing_config'
    | 'service_mode'
    | 'skipped_local'
    | 'timeout'
    | 'traffic_disabled'
    | 'unreachable';
};

export type ReadinessHealthResponse = {
  status: 'ok' | 'fail';
  service: 'nextjs';
  appEnv: string;
  timestamp: string;
  latencyMs: number;
  checks: {
    mediaPublic: DependencyHealth;
    mediaUpload: DependencyHealth;
    postgres: DependencyHealth;
    redis: DependencyHealth;
    traffic: DependencyHealth;
  };
  deploymentVersion?: string;
};

export type ReadinessMode = 'public' | 'service';

type ReadinessEnv = {
  appEnv: string;
  deploymentVersion?: string;
  hostTrafficEnabled?: 'true' | 'false';
  hostTrafficStateFile?: string;
  mediaPublicBaseUrl?: string;
  mediaUploadBaseUrl?: string;
  redisUrl?: string;
};

type ReadinessCheckers = {
  http: (url: string, timeoutMs: number) => Promise<void>;
  postgres: (timeoutMs: number) => Promise<void>;
  redis: (redisUrl: string, timeoutMs: number) => Promise<void>;
  trafficState: (stateFile?: string) => Promise<'true' | 'false' | undefined>;
};

type ReadinessOptions = {
  env?: ReadinessEnv;
  checkers?: Partial<ReadinessCheckers>;
  mode?: ReadinessMode;
  timeoutMs?: number;
};

function defaultEnv(): ReadinessEnv {
  return {
    appEnv: Env.APP_ENV,
    deploymentVersion: Env.DEPLOYMENT_VERSION,
    hostTrafficEnabled: Env.HOST_TRAFFIC_ENABLED,
    hostTrafficStateFile: Env.HOST_TRAFFIC_STATE_FILE,
    mediaPublicBaseUrl: Env.MEDIA_PUBLIC_BASE_URL,
    mediaUploadBaseUrl: Env.MEDIA_UPLOAD_BASE_URL,
    redisUrl: Env.REDIS_URL,
  };
}

function externalDependencyIsRequired(appEnv: string): boolean {
  return appEnv === 'staging' || appEnv === 'production';
}

async function checkPostgres(timeoutMs: number): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL statement_timeout = ${healthPostgresStatementTimeoutMs}`
      );
      await tx.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    },
    {
      maxWait: timeoutMs,
      timeout: timeoutMs,
    }
  );
}

async function checkRedis(redisUrl: string, timeoutMs: number): Promise<void> {
  const client = new IORedis(redisUrl, {
    connectTimeout: timeoutMs,
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

async function checkHttp(url: string, timeoutMs: number): Promise<void> {
  const response = await fetch(url, {
    cache: 'no-store',
    method: 'GET',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Health check returned ${response.status}`);
  }
}

async function readTrafficStateFile(
  stateFile?: string
): Promise<'true' | 'false' | undefined> {
  if (!stateFile) {
    return undefined;
  }
  const fileContents = await readFile(stateFile, 'utf8');
  const value = fileContents.trim();
  return value === 'true' ? 'true' : 'false';
}

async function timeoutFailure(
  timeoutMs: number,
  signal: AbortSignal
): Promise<never> {
  await delay(timeoutMs, undefined, { signal });
  throw new Error('health check timed out');
}

function healthFailureCode(error: unknown): DependencyHealth['code'] {
  if (!(error instanceof Error)) {
    return 'unreachable';
  }
  if (
    error.name === 'AbortError' ||
    error.name === 'TimeoutError' ||
    error.message.includes('timed out') ||
    error.message.includes('timeout')
  ) {
    return 'timeout';
  }
  return 'unreachable';
}

async function measureCheck(params: {
  required: boolean;
  timeoutMs: number;
  run: (timeoutMs: number) => Promise<void>;
}): Promise<DependencyHealth> {
  const startedAt = performance.now();
  const timeout = new AbortController();
  try {
    await Promise.race([
      params.run(params.timeoutMs),
      timeoutFailure(params.timeoutMs, timeout.signal),
    ]);
    return {
      status: 'ok',
      required: params.required,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch (error: unknown) {
    return {
      status: 'fail',
      required: params.required,
      latencyMs: Math.round(performance.now() - startedAt),
      code: healthFailureCode(error),
    };
  } finally {
    timeout.abort();
  }
}

function skippedDependencyCheck(required: boolean): DependencyHealth {
  return {
    status: 'skip',
    required,
    latencyMs: 0,
    code: required ? 'missing_config' : 'skipped_local',
  };
}

function trafficCheck(params: {
  hostTrafficEnabled?: 'true' | 'false';
  mode: ReadinessMode;
}): DependencyHealth {
  if (params.mode === 'service') {
    return {
      status: 'skip',
      required: false,
      latencyMs: 0,
      code: 'service_mode',
    };
  }
  if (params.hostTrafficEnabled === 'false') {
    return {
      status: 'fail',
      required: true,
      latencyMs: 0,
      code: 'traffic_disabled',
    };
  }
  return {
    status: 'ok',
    required: true,
    latencyMs: 0,
  };
}

function healthUrl(baseUrl: string, pathname: string): string {
  return new URL(pathname, baseUrl).toString();
}

function optionalHttpCheck(params: {
  baseUrl?: string;
  checkers: ReadinessCheckers;
  path: string;
  required: boolean;
  timeoutMs: number;
}): DependencyHealth | Promise<DependencyHealth> {
  if (!params.baseUrl) {
    return skippedDependencyCheck(params.required);
  }
  const url = healthUrl(params.baseUrl, params.path);
  return measureCheck({
    required: params.required,
    timeoutMs: params.timeoutMs,
    run: async (checkTimeoutMs) => {
      await params.checkers.http(url, checkTimeoutMs);
    },
  });
}

export async function getReadinessHealth(
  options: ReadinessOptions = {}
): Promise<ReadinessHealthResponse> {
  const env = options.env ?? defaultEnv();
  const mode = options.mode ?? 'public';
  const timeoutMs = options.timeoutMs ?? healthTimeoutMs;
  const checkers: ReadinessCheckers = {
    http: options.checkers?.http ?? checkHttp,
    postgres: options.checkers?.postgres ?? checkPostgres,
    redis: options.checkers?.redis ?? checkRedis,
    trafficState: options.checkers?.trafficState ?? readTrafficStateFile,
  };
  const startedAt = performance.now();
  const isExternalDependencyRequired = externalDependencyIsRequired(env.appEnv);

  const postgresPromise = measureCheck({
    required: true,
    timeoutMs,
    run: checkers.postgres,
  });
  const { redisUrl } = env;
  const redisPromise = redisUrl
    ? measureCheck({
        required: isExternalDependencyRequired,
        timeoutMs,
        run: async (checkTimeoutMs) => {
          await checkers.redis(redisUrl, checkTimeoutMs);
        },
      })
    : Promise.resolve(skippedDependencyCheck(isExternalDependencyRequired));
  const mediaUploadPromise = optionalHttpCheck({
    baseUrl: env.mediaUploadBaseUrl,
    checkers,
    path: '/api/health/live',
    required: isExternalDependencyRequired,
    timeoutMs,
  });
  const mediaPublicPromise = optionalHttpCheck({
    baseUrl: env.mediaPublicBaseUrl,
    checkers,
    path: '/healthz',
    required: isExternalDependencyRequired,
    timeoutMs,
  });
  const trafficPromise = (async () => {
    try {
      const hostTrafficState = await checkers.trafficState(
        env.hostTrafficStateFile
      );
      return trafficCheck({
        hostTrafficEnabled: hostTrafficState ?? env.hostTrafficEnabled,
        mode,
      });
    } catch {
      return trafficCheck({
        hostTrafficEnabled: 'false',
        mode,
      });
    }
  })();

  const [postgres, redis, mediaUpload, mediaPublic, traffic] =
    await Promise.all([
      postgresPromise,
      redisPromise,
      mediaUploadPromise,
      mediaPublicPromise,
      trafficPromise,
    ]);
  const checks = { mediaPublic, mediaUpload, postgres, redis, traffic };
  const requiredChecks = Object.values(checks).filter(
    (check) => check.required
  );
  const status = requiredChecks.every((check) => check.status === 'ok')
    ? 'ok'
    : 'fail';

  return {
    status,
    service: 'nextjs',
    appEnv: env.appEnv,
    timestamp: new Date().toISOString(),
    latencyMs: Math.round(performance.now() - startedAt),
    checks,
    deploymentVersion: env.deploymentVersion,
  };
}
