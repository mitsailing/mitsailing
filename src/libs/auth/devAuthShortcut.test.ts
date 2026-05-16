import { afterEach, describe, expect, it, vi } from 'vitest';

function stubRequiredBaseEnv(): void {
  vi.stubEnv(
    'BETTER_AUTH_SECRET',
    'test-secret-that-is-at-least-thirty-two-chars'
  );
  vi.stubEnv(
    'DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/dev_db?sslmode=disable'
  );
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
}

function stubRequiredDeployedEnv(): void {
  vi.stubEnv('CMS_MEDIA_ROOT', '/var/cms-media');
  vi.stubEnv(
    'HEALTHCHECK_SECRET',
    'test-healthcheck-secret-with-thirty-two-chars'
  );
  vi.stubEnv('REDIS_URL', 'redis://redis:6379');
}

describe('isDevAuthShortcutEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns true for APP_ENV local without IS_E2E', async () => {
    stubRequiredBaseEnv();
    vi.stubEnv('APP_ENV', 'local');

    const { isDevAuthShortcutEnabled } =
      await import('@/libs/auth/devAuthShortcut');

    expect(isDevAuthShortcutEnabled()).toBe(true);
  });

  it('returns false for APP_ENV staging', async () => {
    stubRequiredBaseEnv();
    vi.stubEnv('APP_ENV', 'staging');
    stubRequiredDeployedEnv();

    const { isDevAuthShortcutEnabled } =
      await import('@/libs/auth/devAuthShortcut');

    expect(isDevAuthShortcutEnabled()).toBe(false);
  });

  it('returns false for APP_ENV production', async () => {
    stubRequiredBaseEnv();
    vi.stubEnv('APP_ENV', 'production');
    stubRequiredDeployedEnv();

    const { isDevAuthShortcutEnabled } =
      await import('@/libs/auth/devAuthShortcut');

    expect(isDevAuthShortcutEnabled()).toBe(false);
  });

  it('returns false when IS_E2E is set even if APP_ENV is local', async () => {
    stubRequiredBaseEnv();
    vi.stubEnv('APP_ENV', 'local');
    vi.stubEnv('IS_E2E', '1');

    const { isDevAuthShortcutEnabled } =
      await import('@/libs/auth/devAuthShortcut');

    expect(isDevAuthShortcutEnabled()).toBe(false);
  });

  it('returns false for APP_ENV test', async () => {
    stubRequiredBaseEnv();
    vi.stubEnv('APP_ENV', 'test');

    const { isDevAuthShortcutEnabled } =
      await import('@/libs/auth/devAuthShortcut');

    expect(isDevAuthShortcutEnabled()).toBe(false);
  });
});
