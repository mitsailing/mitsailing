import type * as ReactModule from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listUserRatingAssignmentRows } from '@/libs/mit-sailing/sailingRatingQueries';
import type { SailingRatingReadClient } from '@/libs/mit-sailing/sailingRatingQueries';

vi.mock('server-only', () => ({}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

const mocks = vi.hoisted(() => ({
  fleetBoatFindMany: vi.fn(),
  sailingClassFindMany: vi.fn(),
  sailingRatingFindMany: vi.fn(),
  sailingRatingRuleFindMany: vi.fn(),
  userSailingRatingFindMany: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Prisma client test double
const client = {
  fleetBoat: { findMany: mocks.fleetBoatFindMany },
  sailingClass: { findMany: mocks.sailingClassFindMany },
  sailingRating: { findMany: mocks.sailingRatingFindMany },
  sailingRatingRule: { findMany: mocks.sailingRatingRuleFindMany },
  userSailingRating: { findMany: mocks.userSailingRatingFindMany },
} as unknown as SailingRatingReadClient;

function catalogRating(props: { readonly id: string; readonly name: string }) {
  return {
    id: props.id,
    slug: `${props.id}-slug`,
    name: props.name,
    shortName: props.name,
    description: `${props.name} description`,
    category: null,
    level: null,
    windCondition: null,
    guideUrl: null,
    isDeprecated: false,
  };
}

describe('listUserRatingAssignmentRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fleetBoatFindMany.mockResolvedValue([]);
    mocks.sailingClassFindMany.mockResolvedValue([]);
    mocks.sailingRatingRuleFindMany.mockResolvedValue([]);
    mocks.userSailingRatingFindMany.mockResolvedValue([]);
  });

  it('lists only seed catalog ratings when user has no legacy-only grants', async () => {
    mocks.sailingRatingFindMany.mockResolvedValueOnce([
      catalogRating({ id: 'rating-swim', name: 'Swim Rating' }),
      catalogRating({ id: 'rating-tech', name: 'Tech Rating' }),
    ]);

    const rows = await listUserRatingAssignmentRows('user-1', { client });

    expect(rows.map((row) => row.id)).toEqual(['rating-swim', 'rating-tech']);
    expect(mocks.sailingRatingFindMany).toHaveBeenCalledTimes(1);
  });

  it('appends granted legacy-only ratings not in the seed catalog', async () => {
    mocks.sailingRatingFindMany
      .mockResolvedValueOnce([
        catalogRating({ id: 'rating-swim', name: 'Swim Rating' }),
      ])
      .mockResolvedValueOnce([
        catalogRating({
          id: 'legacy-bosun-id',
          name: 'Bosun',
        }),
      ]);
    mocks.userSailingRatingFindMany.mockResolvedValue([
      {
        sailingRatingId: 'legacy-bosun-id',
        issuedAt: new Date('2024-06-01T12:00:00.000Z'),
        issuedBy: { name: 'Coach' },
      },
    ]);

    const rows = await listUserRatingAssignmentRows('user-1', { client });

    expect(rows.map((row) => row.id)).toEqual([
      'rating-swim',
      'legacy-bosun-id',
    ]);
    expect(rows[1]?.issuedAt).toEqual(new Date('2024-06-01T12:00:00.000Z'));
    expect(mocks.sailingRatingFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['legacy-bosun-id'] },
        }),
      })
    );
  });

  it('omits ungranted legacy-only ratings such as bosun from the catalog list', async () => {
    mocks.sailingRatingFindMany.mockResolvedValueOnce([
      catalogRating({ id: 'rating-swim', name: 'Swim Rating' }),
    ]);

    const rows = await listUserRatingAssignmentRows('user-1', { client });

    expect(rows.some((row) => row.name === 'Bosun')).toBe(false);
    expect(mocks.sailingRatingFindMany).toHaveBeenCalledTimes(1);
  });
});
