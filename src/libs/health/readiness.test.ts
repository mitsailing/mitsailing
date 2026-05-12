import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it, vi } from 'vitest';
import { getReadinessHealth } from './readiness';

describe('getReadinessHealth', () => {
  it('returns ok when required checks pass', async () => {
    const health = await getReadinessHealth({
      env: {
        appEnv: 'production',
        deploymentVersion: 'sha-test',
        redisUrl: 'redis://redis:6379',
      },
      checkers: {
        postgres: vi.fn(async () => {}),
        redis: vi.fn(async () => {}),
      },
    });

    expect(health.status).toBe('ok');
    expect(health.deploymentVersion).toBe('sha-test');
    expect(health.checks.postgres.status).toBe('ok');
    expect(health.checks.redis.status).toBe('ok');
    expect(health.checks.redis.required).toBe(true);
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
        postgres: vi.fn(async () => {}),
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
        postgres: vi.fn(async () => {}),
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
