import { afterEach, describe, expect, it, vi } from 'vitest';
import { LEGACY_MYSQL_SYNC_DEFAULT_CRON } from '@/libs/legacy-sync/legacyMysqlSyncConstants';

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

function stubNewsletterRevalidateSecret(): void {
  vi.stubEnv(
    'NEWSLETTER_REVALIDATE_SECRET',
    'test-newsletter-revalidate-secret-with-thirty-two-chars'
  );
}

describe('Env legacy MySQL sync validation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('defaults legacy MySQL sync to disabled with an hourly cron', async () => {
    stubRequiredBaseEnv();
    stubNewsletterRevalidateSecret();
    const { Env } = await import('@/libs/Env');

    expect(Env.LEGACY_MYSQL_SYNC_ENABLED).toBe('false');
    expect(Env.LEGACY_MYSQL_SYNC_CRON).toBe(LEGACY_MYSQL_SYNC_DEFAULT_CRON);
  });

  it('allows builds without newsletter archive revalidation secret', async () => {
    stubRequiredBaseEnv();
    vi.stubEnv('NEWSLETTER_REVALIDATE_SECRET', '');

    const { Env } = await import('@/libs/Env');

    expect(Env.NEWSLETTER_REVALIDATE_SECRET).toBeUndefined();
  });

  it('rejects enabled legacy MySQL sync outside production', async () => {
    stubRequiredBaseEnv();
    stubNewsletterRevalidateSecret();
    vi.stubEnv('APP_ENV', 'local');
    vi.stubEnv('LEGACY_MYSQL_SYNC_ENABLED', 'true');
    vi.stubEnv('LEGACY_MYSQL_PASSWORD', 'secret');

    await expect(import('@/libs/Env')).rejects.toThrow(
      'Invalid environment variables'
    );
  });

  it('requires MySQL password when sync is enabled', async () => {
    stubRequiredBaseEnv();
    stubNewsletterRevalidateSecret();
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('CMS_MEDIA_ROOT', '/var/lib/mitsailing/cms-media');
    vi.stubEnv('LEGACY_MYSQL_SYNC_ENABLED', 'true');

    await expect(import('@/libs/Env')).rejects.toThrow(
      'Invalid environment variables'
    );
  });

  it('rejects malformed legacy mysql sync cron', async () => {
    stubRequiredBaseEnv();
    stubNewsletterRevalidateSecret();
    vi.stubEnv('LEGACY_MYSQL_SYNC_CRON', '0 0 * * *');

    await expect(import('@/libs/Env')).rejects.toThrow(
      'Invalid environment variables'
    );
  });

  it('accepts custom six-field legacy mysql sync cron', async () => {
    stubRequiredBaseEnv();
    stubNewsletterRevalidateSecret();
    vi.stubEnv('LEGACY_MYSQL_SYNC_CRON', '0 15 * * * *');

    const { Env } = await import('@/libs/Env');

    expect(Env.LEGACY_MYSQL_SYNC_CRON).toBe('0 15 * * * *');
  });

  it('accepts legacy mysql sync in production when password is set', async () => {
    stubRequiredBaseEnv();
    stubNewsletterRevalidateSecret();
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('CMS_MEDIA_ROOT', '/var/lib/mitsailing/cms-media');
    vi.stubEnv('LEGACY_MYSQL_SYNC_ENABLED', 'true');
    vi.stubEnv('LEGACY_MYSQL_PASSWORD', 'secret');

    const { Env } = await import('@/libs/Env');

    expect(Env.LEGACY_MYSQL_SYNC_ENABLED).toBe('true');
    expect(Env.LEGACY_MYSQL_PASSWORD).toBe('secret');
  });
});
