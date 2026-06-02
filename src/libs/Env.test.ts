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

function stubRequiredProductionEnv(): void {
  vi.stubEnv('CMS_MEDIA_ROOT', '/var/lib/mitsailing/cms-media');
  vi.stubEnv(
    'HEALTHCHECK_SECRET',
    'test-healthcheck-secret-with-thirty-two-chars'
  );
  vi.stubEnv('MEDIA_PUBLIC_BASE_URL', 'https://mitsailing.com');
  vi.stubEnv('MEDIA_STORAGE_ROOT', '/var/lib/mitsailing/cms-media');
  vi.stubEnv('MEDIA_UPLOAD_BASE_URL', 'https://mitsailing.com');
  vi.stubEnv(
    'MEDIA_UPLOAD_SHARED_SECRET',
    'test-upload-secret-with-at-least-thirty-two-chars'
  );
  vi.stubEnv(
    'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY',
    'test-server-actions-key-with-thirty-two-chars'
  );
  vi.stubEnv('REDIS_URL', 'redis://redis:6379');
}

function stubRequiredStripeEnv(): void {
  vi.stubEnv('STRIPE_SECRET_KEY', 'rk_test_restricted_key');
  vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_publishable_key');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_webhook_secret');
  vi.stubEnv(
    'STRIPE_MEMBERSHIP_BILLING_PORTAL_CONFIGURATION_ID',
    'bpc_test_membership'
  );
}

function stubBlankStripeEnv(): void {
  vi.stubEnv('STRIPE_SECRET_KEY', '');
  vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', '');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
  vi.stubEnv('STRIPE_MEMBERSHIP_BILLING_PORTAL_CONFIGURATION_ID', '');
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
    expect(Env.STAGING_BANNER).toBe('no');
  });

  it('accepts staging banner opt-in', async () => {
    stubRequiredBaseEnv();
    stubNewsletterRevalidateSecret();
    vi.stubEnv('STAGING_BANNER', 'yes');

    const { Env } = await import('@/libs/Env');

    expect(Env.STAGING_BANNER).toBe('yes');
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
    stubRequiredProductionEnv();
    stubRequiredStripeEnv();
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
    stubRequiredProductionEnv();
    stubRequiredStripeEnv();
    vi.stubEnv('LEGACY_MYSQL_SYNC_ENABLED', 'true');
    vi.stubEnv('LEGACY_MYSQL_PASSWORD', 'secret');

    const { Env } = await import('@/libs/Env');

    expect(Env.LEGACY_MYSQL_SYNC_ENABLED).toBe('true');
    expect(Env.LEGACY_MYSQL_PASSWORD).toBe('secret');
  });

  it('requires media server settings in production', async () => {
    stubRequiredBaseEnv();
    stubNewsletterRevalidateSecret();
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('CMS_MEDIA_ROOT', '/var/lib/mitsailing/cms-media');
    vi.stubEnv('HEALTHCHECK_SECRET', 'x'.repeat(32));
    vi.stubEnv('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY', 'x'.repeat(32));
    vi.stubEnv('REDIS_URL', 'redis://10.0.0.10:6379');
    stubRequiredStripeEnv();

    await expect(import('@/libs/Env')).rejects.toThrow(
      'Invalid environment variables'
    );
  });

  it('accepts docker stack production media endpoints', async () => {
    stubRequiredBaseEnv();
    stubNewsletterRevalidateSecret();
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://mitsailing:secret@10.0.0.10:5432/mitsailing_prod?schema=public'
    );
    vi.stubEnv('HEALTHCHECK_SECRET', 'x'.repeat(32));
    vi.stubEnv('HOST_TRAFFIC_ENABLED', 'false');
    vi.stubEnv('HOST_TRAFFIC_STATE_FILE', '/run/mitsailing/traffic-enabled');
    vi.stubEnv('MEDIA_PUBLIC_BASE_URL', 'https://mitsailing.com');
    vi.stubEnv('MEDIA_STORAGE_ROOT', '/var/lib/mitsailing/cms-media');
    vi.stubEnv('MEDIA_UPLOAD_BASE_URL', 'https://mitsailing.com');
    vi.stubEnv(
      'MEDIA_UPLOAD_SHARED_SECRET',
      'test-upload-secret-with-at-least-thirty-two-chars'
    );
    vi.stubEnv('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY', 'x'.repeat(32));
    vi.stubEnv('REDIS_URL', 'redis://10.0.0.10:6379');
    stubRequiredStripeEnv();

    const { Env } = await import('@/libs/Env');

    expect(Env.HOST_TRAFFIC_ENABLED).toBe('false');
    expect(Env.HOST_TRAFFIC_STATE_FILE).toBe('/run/mitsailing/traffic-enabled');
    expect(Env.MEDIA_PUBLIC_BASE_URL).toBe('https://mitsailing.com');
    expect(Env.MEDIA_STORAGE_ROOT).toBe('/var/lib/mitsailing/cms-media');
    expect(Env.MEDIA_UPLOAD_BASE_URL).toBe('https://mitsailing.com');
  });

  it('allows local development without Stripe keys', async () => {
    stubRequiredBaseEnv();
    stubNewsletterRevalidateSecret();
    stubBlankStripeEnv();

    const { Env } = await import('@/libs/Env');

    expect(Env.STRIPE_SECRET_KEY).toBeUndefined();
    expect(Env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).toBeUndefined();
    expect(Env.STRIPE_WEBHOOK_SECRET).toBeUndefined();
  });

  it('requires Stripe keys in staging', async () => {
    stubRequiredBaseEnv();
    stubNewsletterRevalidateSecret();
    vi.stubEnv('APP_ENV', 'staging');
    stubRequiredProductionEnv();
    stubBlankStripeEnv();

    await expect(import('@/libs/Env')).rejects.toThrow(
      'Invalid environment variables'
    );
  });

  it('accepts Stripe keys in production', async () => {
    stubRequiredBaseEnv();
    stubNewsletterRevalidateSecret();
    vi.stubEnv('APP_ENV', 'production');
    stubRequiredProductionEnv();
    stubRequiredStripeEnv();

    const { Env } = await import('@/libs/Env');

    expect(Env.STRIPE_SECRET_KEY).toBe('rk_test_restricted_key');
    expect(Env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).toBe(
      'pk_test_publishable_key'
    );
    expect(Env.STRIPE_WEBHOOK_SECRET).toBe('whsec_test_webhook_secret');
    expect(Env.STRIPE_MEMBERSHIP_BILLING_PORTAL_CONFIGURATION_ID).toBe(
      'bpc_test_membership'
    );
  });
});
