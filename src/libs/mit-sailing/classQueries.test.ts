import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

type UnstableCacheCall = {
  keyParts: string[];
  options: {
    revalidate?: number | false;
    tags?: string[];
  };
};

const { classCategoryFindMany, unstableCache, unstableCacheCalls } = vi.hoisted(
  () => {
    const calls: UnstableCacheCall[] = [];
    return {
      classCategoryFindMany: vi.fn(),
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
    classCategory: {
      findMany: classCategoryFindMany,
    },
  },
}));

beforeEach(() => {
  classCategoryFindMany.mockReset();
  unstableCache.mockClear();
  unstableCacheCalls.length = 0;
  vi.resetModules();
});

describe('listClassCategoriesForNav', () => {
  it('uses a persistent tag cache for class category nav rows', async () => {
    classCategoryFindMany.mockResolvedValue([
      {
        displayOrder: 1,
        id: 'intro',
        name: 'Intro',
        slug: 'intro',
      },
    ]);

    const { listClassCategoriesForNav } =
      await import('@/libs/mit-sailing/classQueries');

    await expect(listClassCategoriesForNav()).resolves.toEqual([
      {
        displayOrder: 1,
        id: 'intro',
        name: 'Intro',
        slug: 'intro',
      },
    ]);

    expect(unstableCacheCalls).toEqual([
      {
        keyParts: ['site-nav-classes'],
        options: {
          revalidate: 86_400,
          tags: ['site-nav-classes'],
        },
      },
    ]);
  });
});
