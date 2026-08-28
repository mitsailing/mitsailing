import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/libs/Env', () => ({
  Env: {
    IS_E2E: '1',
    NEXT_PUBLIC_APP_URL: 'https://mitsailing.test',
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

beforeEach(() => {
  eventFindMany.mockResolvedValue([]);
  fleetBoatFindMany.mockResolvedValue([]);
  sailingClassFindMany.mockResolvedValue([]);
});

describe('sitemap', () => {
  it('includes pricing in static routes', async () => {
    const { default: sitemap } = await import('./sitemap');

    const routes = await sitemap();

    expect(routes.map((route) => new URL(route.url).pathname)).toContain(
      '/pricing'
    );
  });
});
