import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, newsletterSignupRateLimit } from '@/libs/rateLimit';

const mocks = vi.hoisted(() => {
  const redisData = new Map<string, number>();
  const env = {
    IS_E2E: undefined as '1' | undefined,
    REDIS_URL: undefined as string | undefined,
  };

  function incr(rawArgs: readonly unknown[]): [number, number] {
    const flat =
      rawArgs.length === 1 && Array.isArray(rawArgs[0]) ? rawArgs[0] : rawArgs;
    const key = String(flat[0]);
    const points = Number(flat[1]);
    const seconds = Number(flat[2]);
    const consumed = (redisData.get(key) ?? 0) + points;
    redisData.set(key, consumed);
    return [consumed, seconds * 1000];
  }

  return { env, incr, redisData };
});

vi.mock('server-only', () => ({}));
vi.mock('@/libs/Env', () => ({ Env: mocks.env }));
vi.mock('@/libs/Logger', () => ({
  logger: { error: vi.fn() },
}));
vi.mock('ioredis', () => ({
  default: class {
    on() {
      return this;
    }

    multi() {
      return this;
    }

    defineCommand(name: string) {
      Object.defineProperty(this, name, {
        configurable: true,
        // eslint-disable-next-line @typescript-eslint/promise-function-async -- command stub resolves the count directly
        value: (...args: readonly unknown[]) =>
          Promise.resolve(mocks.incr(args)),
      });
    }
  },
}));

describe('checkRateLimit', () => {
  beforeEach(() => {
    mocks.env.IS_E2E = undefined;
    mocks.env.REDIS_URL = undefined;
    mocks.redisData.clear();
  });

  it('allow five newsletter signup consumes then block the sixth', async () => {
    mocks.env.IS_E2E = undefined;
    const clientId = 'signup-1';
    for (let i = 0; i < newsletterSignupRateLimit.points - 1; i += 1) {
      await checkRateLimit({
        ...newsletterSignupRateLimit,
        key: clientId,
      });
    }

    expect(
      await checkRateLimit({
        ...newsletterSignupRateLimit,
        key: clientId,
      })
    ).toEqual({ rateLimited: false });
    expect(
      await checkRateLimit({
        ...newsletterSignupRateLimit,
        key: clientId,
      })
    ).toEqual({ rateLimited: true });
  });

  it('block the sixth newsletter signup from a second process', async () => {
    mocks.env.REDIS_URL = 'redis://redis:6379';
    const key = 'cross-process-signup';
    vi.resetModules();
    const firstProcess = await import('@/libs/rateLimit');
    for (let i = 0; i < newsletterSignupRateLimit.points; i += 1) {
      await firstProcess.checkRateLimit({
        ...newsletterSignupRateLimit,
        key,
      });
    }

    vi.resetModules();
    const secondProcess = await import('@/libs/rateLimit');
    expect(
      await secondProcess.checkRateLimit({
        ...newsletterSignupRateLimit,
        key,
      })
    ).toEqual({ rateLimited: true });
  });

  it('allow sixth consume when e2e is enabled', async () => {
    mocks.env.IS_E2E = '1';
    const clientId = 'signup-2';
    for (let i = 0; i < newsletterSignupRateLimit.points; i += 1) {
      await checkRateLimit({
        ...newsletterSignupRateLimit,
        key: clientId,
      });
    }

    expect(
      await checkRateLimit({
        ...newsletterSignupRateLimit,
        key: clientId,
      })
    ).toEqual({ rateLimited: false });
  });
});
