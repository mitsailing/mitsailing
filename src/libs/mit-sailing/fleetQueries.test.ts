import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

type UnstableCacheCall = {
  keyParts: string[];
  options: {
    revalidate?: number | false;
    tags?: string[];
  };
};

const { fleetBoatFindMany, unstableCache, unstableCacheCalls } = vi.hoisted(
  () => {
    const calls: UnstableCacheCall[] = [];
    return {
      fleetBoatFindMany: vi.fn(),
      unstableCache: vi.fn(
        (
          fn: () => Promise<unknown>,
          keyParts: string[],
          options: UnstableCacheCall['options']
        ) => {
          calls.push({ keyParts, options });
          return fn;
        }
      ),
      unstableCacheCalls: calls,
    };
  }
);

vi.mock('react', () => ({
  cache: (fn: () => Promise<unknown>) => fn,
}));

vi.mock('next/cache', () => ({
  unstable_cache: unstableCache,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    fleetBoat: {
      findMany: fleetBoatFindMany,
    },
    sailingRatingRule: {
      findMany: vi.fn(),
    },
  },
}));

beforeEach(() => {
  fleetBoatFindMany.mockReset();
  unstableCache.mockClear();
  unstableCacheCalls.length = 0;
  vi.resetModules();
});

describe('listFleetBoatsForNav', () => {
  it('uses a persistent tag cache for fleet nav rows', async () => {
    fleetBoatFindMany.mockResolvedValue([
      {
        id: 'tech',
        name: 'Tech Dinghy',
        slug: 'tech-dinghy',
      },
    ]);

    const { listFleetBoatsForNav } =
      await import('@/libs/mit-sailing/fleetQueries');

    await expect(listFleetBoatsForNav()).resolves.toEqual([
      {
        id: 'tech',
        name: 'Tech Dinghy',
        slug: 'tech-dinghy',
      },
    ]);

    expect(unstableCacheCalls).toEqual([
      {
        keyParts: ['site-nav-fleet'],
        options: {
          revalidate: 86_400,
          tags: ['site-nav-fleet'],
        },
      },
    ]);
  });
});
