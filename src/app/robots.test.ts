import { afterEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
  STAGING_BANNER: 'no' as 'no' | 'yes',
  NEXT_PUBLIC_APP_URL: 'https://mitsailing.test',
}));

vi.mock('@/libs/Env', () => ({
  Env: env,
}));

describe('robots', () => {
  afterEach(() => {
    vi.resetModules();
    env.STAGING_BANNER = 'no';
  });

  it('advertises the sitemap when preview is off', async () => {
    const { default: robots } = await import('./robots');
    const result = robots();

    expect(result.rules).toEqual({ userAgent: '*', allow: '/' });
    expect(result.sitemap).toBe('https://mitsailing.test/sitemap.xml');
  });

  it('omits the sitemap when preview is on', async () => {
    env.STAGING_BANNER = 'yes';
    const { default: robots } = await import('./robots');
    const result = robots();

    expect(result.rules).toEqual({ userAgent: '*', allow: '/' });
    expect(result.sitemap).toBeUndefined();
  });
});
