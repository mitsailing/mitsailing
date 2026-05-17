import { setTimeout as delay } from 'node:timers/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getReadinessHealth } from './readiness';

const {
  executeRawMock,
  executeRawUnsafeMock,
  queryRawMock,
  redisConnectMock,
  redisConstructorMock,
  redisDisconnectMock,
  redisPingMock,
  transactionMock,
} = vi.hoisted(() => ({
  executeRawMock: vi.fn(),
  executeRawUnsafeMock: vi.fn(),
  queryRawMock: vi.fn(),
  redisConnectMock: vi.fn(),
  redisConstructorMock: vi.fn(),
  redisDisconnectMock: vi.fn(),
  redisPingMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock('ioredis', () => ({
  default: redisConstructorMock,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  redisConstructorMock.mockImplementation(function IORedis() {
    return {
      connect: redisConnectMock,
      disconnect: redisDisconnectMock,
      ping: redisPingMock,
    };
  });
});

function passingCheckers() {
  return {
    http: vi.fn(async () => {}),
    postgres: vi.fn(async () => {}),
    redis: vi.fn(async () => {}),
  };
}

function productionReadinessEnv() {
  return {
    appEnv: 'production',
    hostTrafficEnabled: 'true' as const,
    mediaPublicBaseUrl: 'https://media.mitsailing.com',
    mediaUploadBaseUrl: 'https://uploads.mitsailing.com',
    redisUrl: 'redis://redis:6379',
  };
}

describe('getReadinessHealth', () => {
  it('bounds postgres readiness queries with prisma transaction timeout', async () => {
    transactionMock.mockImplementation(async (transaction) => {
      await transaction({
        $executeRaw: executeRawMock,
        $executeRawUnsafe: executeRawUnsafeMock,
        $queryRaw: queryRawMock,
      });
    });

    await getReadinessHealth({
      env: { appEnv: 'local' },
      timeoutMs: 17,
    });

    expect(transactionMock).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 17,
      timeout: 17,
    });
  });

  it('sets postgres statement timeout with raw set local statement', async () => {
    transactionMock.mockImplementation(async (transaction) => {
      await transaction({
        $executeRaw: executeRawMock,
        $executeRawUnsafe: executeRawUnsafeMock,
        $queryRaw: queryRawMock,
      });
    });

    await getReadinessHealth({
      env: { appEnv: 'local' },
      timeoutMs: 17,
    });

    expect(executeRawUnsafeMock).toHaveBeenCalledWith(
      'SET LOCAL statement_timeout = 1000'
    );
    expect(executeRawMock).not.toHaveBeenCalled();
  });

  it('configures redis readiness client for bounded health probes', async () => {
    transactionMock.mockImplementation(async (transaction) => {
      await transaction({
        $executeRaw: executeRawMock,
        $executeRawUnsafe: executeRawUnsafeMock,
        $queryRaw: queryRawMock,
      });
    });

    await getReadinessHealth({
      env: { appEnv: 'production', redisUrl: 'redis://redis:6379' },
      timeoutMs: 23,
    });

    expect(redisConstructorMock).toHaveBeenCalledWith('redis://redis:6379', {
      connectTimeout: 23,
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: expect.any(Function),
    });
    expect(redisConnectMock).toHaveBeenCalledTimes(1);
    expect(redisPingMock).toHaveBeenCalledTimes(1);
    expect(redisDisconnectMock).toHaveBeenCalledTimes(1);
  });

  it('returns ok when required checks pass', async () => {
    const health = await getReadinessHealth({
      env: {
        appEnv: 'production',
        deploymentVersion: 'sha-test',
        hostTrafficEnabled: 'true',
        mediaPublicBaseUrl: 'https://media.mitsailing.com',
        mediaUploadBaseUrl: 'https://uploads.mitsailing.com',
        redisUrl: 'redis://redis:6379',
      },
      checkers: {
        http: vi.fn(async () => {}),
        postgres: vi.fn(async () => {}),
        redis: vi.fn(async () => {}),
      },
    });

    expect(health.status).toBe('ok');
    expect(health.deploymentVersion).toBe('sha-test');
    expect(health.checks.postgres.status).toBe('ok');
    expect(health.checks.redis.status).toBe('ok');
    expect(health.checks.redis.required).toBe(true);
    expect(health.checks.mediaUpload.status).toBe('ok');
    expect(health.checks.mediaPublic.status).toBe('ok');
    expect(health.checks.traffic.status).toBe('ok');
  });

  it('checks media service health endpoints in production', async () => {
    const httpCheck = vi.fn(async () => {});

    await getReadinessHealth({
      env: {
        appEnv: 'production',
        hostTrafficEnabled: 'true',
        mediaPublicBaseUrl: 'https://media.mitsailing.com',
        mediaUploadBaseUrl: 'https://uploads.mitsailing.com',
        redisUrl: 'redis://redis:6379',
      },
      timeoutMs: 31,
      checkers: {
        http: httpCheck,
        postgres: vi.fn(async () => {}),
        redis: vi.fn(async () => {}),
      },
    });

    expect(httpCheck).toHaveBeenCalledWith(
      'https://uploads.mitsailing.com/api/health/live',
      31
    );
    expect(httpCheck).toHaveBeenCalledWith(
      'https://media.mitsailing.com/healthz',
      31
    );
  });

  it('fails when required media upload url is missing', async () => {
    const health = await getReadinessHealth({
      env: {
        appEnv: 'production',
        hostTrafficEnabled: 'true',
        mediaPublicBaseUrl: 'https://media.mitsailing.com',
        redisUrl: 'redis://redis:6379',
      },
      checkers: {
        http: vi.fn(async () => {}),
        postgres: vi.fn(async () => {}),
        redis: vi.fn(async () => {}),
      },
    });

    expect(health.status).toBe('fail');
    expect(health.checks.mediaUpload).toEqual({
      status: 'skip',
      required: true,
      latencyMs: 0,
      code: 'missing_config',
    });
  });

  it('fails public readiness when host traffic is disabled', async () => {
    const health = await getReadinessHealth({
      env: {
        ...productionReadinessEnv(),
        hostTrafficEnabled: 'false',
      },
      checkers: passingCheckers(),
    });

    expect(health.status).toBe('fail');
    expect(health.checks.traffic).toEqual({
      status: 'fail',
      required: true,
      latencyMs: 0,
      code: 'traffic_disabled',
    });
  });

  it('uses host traffic state file over static env flag', async () => {
    const trafficState = vi
      .fn<() => Promise<'false'>>()
      .mockResolvedValue('false');

    const health = await getReadinessHealth({
      env: {
        ...productionReadinessEnv(),
        hostTrafficEnabled: 'true',
        hostTrafficStateFile: '/run/mitsailing/traffic-enabled',
      },
      checkers: {
        ...passingCheckers(),
        trafficState,
      },
    });

    expect(health.status).toBe('fail');
    expect(health.checks.traffic.code).toBe('traffic_disabled');
    expect(trafficState).toHaveBeenCalledWith(
      '/run/mitsailing/traffic-enabled'
    );
  });

  it('skips host traffic gate for service readiness mode', async () => {
    const health = await getReadinessHealth({
      mode: 'service',
      env: {
        ...productionReadinessEnv(),
        hostTrafficEnabled: 'false',
      },
      checkers: passingCheckers(),
    });

    expect(health.status).toBe('ok');
    expect(health.checks.traffic).toEqual({
      status: 'skip',
      required: false,
      latencyMs: 0,
      code: 'service_mode',
    });
  });

  it('fails when postgres fails', async () => {
    const health = await getReadinessHealth({
      env: { appEnv: 'production', redisUrl: 'redis://redis:6379' },
      checkers: {
        postgres: vi.fn().mockRejectedValue(new Error('database down')),
        redis: vi.fn(async () => {}),
      },
    });

    expect(health.status).toBe('fail');
    expect(health.checks.postgres).toMatchObject({
      status: 'fail',
      required: true,
      code: 'unreachable',
    });
  });

  it('fails when required redis fails', async () => {
    const health = await getReadinessHealth({
      env: { appEnv: 'production', redisUrl: 'redis://redis:6379' },
      checkers: {
        postgres: vi.fn(async () => {}),
        redis: vi.fn().mockRejectedValue(new Error('redis down')),
      },
    });

    expect(health.status).toBe('fail');
    expect(health.checks.redis).toMatchObject({
      status: 'fail',
      required: true,
      code: 'unreachable',
    });
  });

  it('skips redis when local url is missing', async () => {
    const health = await getReadinessHealth({
      env: { appEnv: 'local' },
      checkers: {
        ...passingCheckers(),
        redis: vi.fn().mockRejectedValue(new Error('unused')),
      },
    });

    expect(health.status).toBe('ok');
    expect(health.checks.redis).toEqual({
      status: 'skip',
      required: false,
      latencyMs: 0,
      code: 'skipped_local',
    });
  });

  it('fails when production redis url is missing', async () => {
    const health = await getReadinessHealth({
      env: { appEnv: 'production' },
      checkers: {
        ...passingCheckers(),
        redis: vi.fn().mockRejectedValue(new Error('unused')),
      },
    });

    expect(health.status).toBe('fail');
    expect(health.checks.redis).toEqual({
      status: 'skip',
      required: true,
      latencyMs: 0,
      code: 'missing_config',
    });
  });

  it('fails timed out checks', async () => {
    const health = await getReadinessHealth({
      env: { appEnv: 'production', redisUrl: 'redis://redis:6379' },
      timeoutMs: 5,
      checkers: {
        postgres: async () => {
          await delay(1000);
        },
        redis: vi.fn(async () => {}),
      },
    });

    expect(health.status).toBe('fail');
    expect(health.checks.postgres.code).toBe('timeout');
  });
});
