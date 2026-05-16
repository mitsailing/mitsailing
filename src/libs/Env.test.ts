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

describe('Env legacy MySQL sync validation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('defaults legacy MySQL sync to disabled with an hourly cron', async () => {
    stubRequiredBaseEnv();
    const { Env } = await import('@/libs/Env');

    expect(Env.LEGACY_MYSQL_SYNC_ENABLED).toBe('false');
    expect(Env.LEGACY_MYSQL_SYNC_CRON).toBe('0 0 * * * *');
  });

  it('rejects enabled legacy MySQL sync outside production', async () => {
    stubRequiredBaseEnv();
    vi.stubEnv('APP_ENV', 'local');
    vi.stubEnv('LEGACY_MYSQL_SYNC_ENABLED', 'true');
    vi.stubEnv('LEGACY_MYSQL_PASSWORD', 'secret');

    await expect(import('@/libs/Env')).rejects.toThrow(
      'Invalid environment variables'
    );
  });

  it('requires MySQL password when sync is enabled', async () => {
    stubRequiredBaseEnv();
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('CMS_MEDIA_ROOT', '/var/lib/mitsailing/cms-media');
    vi.stubEnv('LEGACY_MYSQL_SYNC_ENABLED', 'true');

    await expect(import('@/libs/Env')).rejects.toThrow(
      'Invalid environment variables'
    );
  });

  it('accepts legacy mysql sync in production when password is set', async () => {
    stubRequiredBaseEnv();
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('CMS_MEDIA_ROOT', '/var/lib/mitsailing/cms-media');
    vi.stubEnv('LEGACY_MYSQL_SYNC_ENABLED', 'true');
    vi.stubEnv('LEGACY_MYSQL_PASSWORD', 'secret');

    const { Env } = await import('@/libs/Env');

    expect(Env.LEGACY_MYSQL_SYNC_ENABLED).toBe('true');
    expect(Env.LEGACY_MYSQL_PASSWORD).toBe('secret');
  });
});
