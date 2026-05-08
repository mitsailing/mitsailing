import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

const mockEnv = vi.hoisted(() => ({
  NEXT_PUBLIC_IS_E2E: undefined as '1' | undefined,
  NODE_ENV: 'production' as 'development' | 'production' | 'test',
}));

const MockAPIError = vi.hoisted(
  () =>
    class APIError extends Error {
      code: string | undefined;
      status: string;

      constructor(
        status: string,
        options: { code?: string; message?: string } = {}
      ) {
        super(options.message ?? status);
        this.code = options.code;
        this.name = 'APIError';
        this.status = status;
      }

      static from(
        status: string,
        options: { code?: string; message?: string } = {}
      ) {
        return new APIError(status, options);
      }
    }
);

vi.mock('server-only', () => ({}));
vi.mock('@/libs/Env', () => ({ Env: mockEnv }));
vi.mock('better-auth/api', () => ({ APIError: MockAPIError }));

describe('assertPasswordNotCompromised', () => {
  let fetchSpy: MockInstance<(typeof globalThis)['fetch']>;

  beforeEach(() => {
    vi.resetModules();
    mockEnv.NEXT_PUBLIC_IS_E2E = undefined;
    mockEnv.NODE_ENV = 'production';
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('test sailor skips breach lookup when test env disables checks', async () => {
    mockEnv.NODE_ENV = 'test';
    const { assertPasswordNotCompromised, passwordCompromiseCheckEnabled } =
      await import('@/libs/auth/password-compromise');

    await expect(assertPasswordNotCompromised('password')).resolves.toBe(
      undefined
    );

    expect(passwordCompromiseCheckEnabled).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('e2e sailor skips breach lookup when e2e env disables checks', async () => {
    mockEnv.NEXT_PUBLIC_IS_E2E = '1';
    const { assertPasswordNotCompromised, passwordCompromiseCheckEnabled } =
      await import('@/libs/auth/password-compromise');

    await expect(assertPasswordNotCompromised('password')).resolves.toBe(
      undefined
    );

    expect(passwordCompromiseCheckEnabled).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sailor can use an uncompromised password', async () => {
    const password = 'better sailing passphrase';
    const {
      assertPasswordNotCompromised,
      hibpPasswordSha1RangeParts,
      passwordCompromiseCheckEnabled,
    } = await import('@/libs/auth/password-compromise');
    const { prefix, suffix } = hibpPasswordSha1RangeParts(password);
    fetchSpy.mockResolvedValue(
      new Response(`AAAA${suffix.slice(4)}:1\nBBBB${suffix.slice(4)}:3`, {
        status: 200,
      })
    );

    await expect(assertPasswordNotCompromised(password)).resolves.toBe(
      undefined
    );

    expect(passwordCompromiseCheckEnabled).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: {
          'Add-Padding': 'true',
          'User-Agent': 'BetterAuth Password Checker',
        },
        signal: expect.any(AbortSignal),
      }
    );
  });

  it('sailor cannot use a compromised password suffix', async () => {
    const password = 'correct horse battery staple';
    const { assertPasswordNotCompromised, hibpPasswordSha1RangeParts } =
      await import('@/libs/auth/password-compromise');
    const { suffix } = hibpPasswordSha1RangeParts(password);
    fetchSpy.mockResolvedValue(
      new Response(`00000000000000000000000000000000000:2\n${suffix}:42`, {
        status: 200,
      })
    );

    await expect(assertPasswordNotCompromised(password)).rejects.toMatchObject({
      code: 'PASSWORD_COMPROMISED',
      status: 'BAD_REQUEST',
    });
  });

  it('sailor gets a safe error when breach lookup returns non-ok', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 503 }));
    const { assertPasswordNotCompromised } =
      await import('@/libs/auth/password-compromise');

    await expect(
      assertPasswordNotCompromised('password')
    ).rejects.toMatchObject({
      message: 'Failed to check password. Status: 503',
      status: 'INTERNAL_SERVER_ERROR',
    });
  });

  it('sailor gets a safe error when breach lookup has a network failure', async () => {
    fetchSpy.mockRejectedValue(new TypeError('network down'));
    const { assertPasswordNotCompromised } =
      await import('@/libs/auth/password-compromise');

    await expect(
      assertPasswordNotCompromised('password')
    ).rejects.toMatchObject({
      message: 'Failed to check password. Please try again later.',
      status: 'INTERNAL_SERVER_ERROR',
    });
  });

  it('sailor can continue when breach lookup times out', async () => {
    fetchSpy.mockRejectedValue(new DOMException('Timed out', 'AbortError'));
    const { assertPasswordNotCompromised } =
      await import('@/libs/auth/password-compromise');

    await expect(assertPasswordNotCompromised('password')).resolves.toBe(
      undefined
    );
  });

  it('sailor keeps upstream APIError details for auth handling', async () => {
    const apiError = new MockAPIError('BAD_REQUEST', {
      code: 'UPSTREAM_POLICY',
      message: 'Blocked by upstream policy',
    });
    fetchSpy.mockRejectedValue(apiError);
    const { assertPasswordNotCompromised } =
      await import('@/libs/auth/password-compromise');

    await expect(assertPasswordNotCompromised('password')).rejects.toBe(
      apiError
    );
  });
});
