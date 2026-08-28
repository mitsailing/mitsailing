import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { eventFindMany, fleetBoatFindMany, sailingClassFindMany } = vi.hoisted(
  () => ({
    eventFindMany: vi.fn(),
    fleetBoatFindMany: vi.fn(),
    sailingClassFindMany: vi.fn(),
  })
);

vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    event: { findMany: eventFindMany },
    fleetBoat: { findMany: fleetBoatFindMany },
    sailingClass: { findMany: sailingClassFindMany },
  },
}));

const env = vi.hoisted(() => ({
  IS_E2E: '1' as '1' | undefined,
  NEXT_PUBLIC_APP_URL: 'https://mitsailing.test',
  STAGING_BANNER: 'no' as 'no' | 'yes',
}));

vi.mock('@/libs/Env', () => ({
  Env: env,
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  env.STAGING_BANNER = 'no';
  eventFindMany.mockResolvedValue([]);
  fleetBoatFindMany.mockResolvedValue([]);
  sailingClassFindMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.resetModules();
});

describe('sitemap', () => {
  it('includes pricing in static routes', async () => {
    const { default: sitemap } = await import('./sitemap');

    const routes = await sitemap();

    expect(routes.map((route) => new URL(route.url).pathname)).toContain(
      '/pricing'
    );
  });

  it('returns an empty sitemap when preview is on', async () => {
    env.STAGING_BANNER = 'yes';
    const { default: sitemap } = await import('./sitemap');

    await expect(sitemap()).resolves.toEqual([]);
    expect(eventFindMany).not.toHaveBeenCalled();
  });
});
