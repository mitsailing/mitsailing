import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importLegacyRatingRows } from '@/libs/legacy-sync/legacyRatingImport';

const mocks = vi.hoisted(() => ({
  createMany: vi.fn(),
  sailingRatingUpsert: vi.fn(),
  transaction: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

describe('importLegacyRatingRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createMany.mockResolvedValue({ count: 0 });
    mocks.sailingRatingUpsert.mockResolvedValue({ id: 'rating-1' });
    mocks.userFindMany.mockResolvedValue([]);
    mocks.transaction.mockImplementation(
      (operation: (tx: unknown) => unknown) =>
        operation({
          sailingRating: { upsert: mocks.sailingRatingUpsert },
          user: { findMany: mocks.userFindMany },
          userSailingRating: { createMany: mocks.createMany },
        })
    );
  });

  it('imports rating types and skips ratings without matched users', async () => {
    await expect(
      importLegacyRatingRows({
        members: [],
        ratingTypes: [
          {
            basic_opt: null,
            name: 'Provisional',
            rank: '1',
            status: '1',
            type: '2',
          },
        ],
        ratings: [
          {
            basic: null,
            eval_date: '2026-01-01',
            eval_id: 'evaluator',
            id: 'sailor',
            rating_type: '2',
          },
        ],
      })
    ).resolves.toEqual({
      ratingTypesImported: 1,
      userRatingsImported: 0,
      userRatingsSkipped: 1,
    });

    expect(mocks.sailingRatingUpsert).toHaveBeenCalledOnce();
    expect(mocks.createMany).not.toHaveBeenCalled();
  });
});
