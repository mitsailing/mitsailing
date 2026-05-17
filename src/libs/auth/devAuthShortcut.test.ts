import { afterEach, describe, expect, it, vi } from 'vitest';

function stubRequiredBaseEnv(): void {
  const envVars: readonly (readonly [string, string])[] = [
    ['BETTER_AUTH_SECRET', 'test-secret-that-is-at-least-thirty-two-chars'],
    [
      'DATABASE_URL',
      'postgresql://postgres:postgres@localhost:5432/dev_db?sslmode=disable',
    ],
    ['NEXT_PUBLIC_APP_URL', 'http://localhost:3000'],
  ];
  for (const [key, value] of envVars) {
    vi.stubEnv(key, value);
  }
}

function stubRequiredDeployedEnv(): void {
  const envVars: readonly (readonly [string, string])[] = [
    ['CMS_MEDIA_ROOT', '/var/cms-media'],
    ['HEALTHCHECK_SECRET', 'test-healthcheck-secret-with-thirty-two-chars'],
    ['MEDIA_PUBLIC_BASE_URL', 'https://media.mitsailing.com'],
    ['MEDIA_STORAGE_ROOT', '/srv/mitsailing-data/cms-media'],
    ['MEDIA_UPLOAD_BASE_URL', 'https://uploads.mitsailing.com'],
    [
      'MEDIA_UPLOAD_SHARED_SECRET',
      'test-media-upload-secret-with-thirty-two-chars',
    ],
    [
      'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY',
      'test-server-actions-key-with-thirty-two-chars',
    ],
    ['REDIS_URL', 'redis://redis:6379'],
  ];
  for (const [key, value] of envVars) {
    vi.stubEnv(key, value);
  }
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
