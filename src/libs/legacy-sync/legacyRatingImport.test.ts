import { beforeEach, describe, expect, it, vi } from 'vitest';
import { legacyImportTransactionOptions } from '@/libs/legacy-sync/legacyImportTransaction';
import type { LegacyMemberRow } from '@/libs/legacy-sync/legacyMemberIdentity';
import { importLegacyRatingRows } from '@/libs/legacy-sync/legacyRatingImport';

const mocks = vi.hoisted(() => ({
  createMany: vi.fn(),
  executeRaw: vi.fn(),
  queryRaw: vi.fn(),
  sailingRatingUpdate: vi.fn(),
  sailingRatingUpdateMany: vi.fn(),
  sailingRatingUpsert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    $transaction: mocks.transaction,
  },
}));

function activeMember(props: {
  readonly email: string;
  readonly first: string;
  readonly id: string;
  readonly last: string;
}): LegacyMemberRow {
  return {
    active: '1',
    card: null,
    email: props.email,
    emer_email: null,
    emer_name: null,
    emer_phone: null,
    expire_date: null,
    first: props.first,
    id: props.id,
    last: props.last,
    memb_type: null,
    phone: null,
    record: null,
    record_date: null,
    status_type: null,
    username: null,
  };
}

function emptyCatalogReconcile() {
  return {
    catalogGrantsMoved: 0,
    catalogDuplicatesRemoved: 0,
    legacyCatalogRowsHidden: 0,
    techRatingsImplied: 0,
  };
}

describe('importLegacyRatingRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createMany.mockResolvedValue({ count: 0 });
    mocks.executeRaw.mockResolvedValue(0);
    mocks.queryRaw.mockResolvedValue([]);
    mocks.sailingRatingUpdate.mockResolvedValue({ id: 'rating-tech' });
    mocks.sailingRatingUpdateMany.mockResolvedValue({ count: 0 });
    mocks.sailingRatingUpsert.mockResolvedValue({ id: 'legacy-rating-9' });
    mocks.transaction.mockImplementation(
      (operation: (tx: unknown) => unknown) =>
        operation({
          $executeRaw: mocks.executeRaw,
          $queryRaw: mocks.queryRaw,
          sailingRating: {
            update: mocks.sailingRatingUpdate,
            updateMany: mocks.sailingRatingUpdateMany,
            upsert: mocks.sailingRatingUpsert,
          },
          userSailingRating: { createMany: mocks.createMany },
        })
    );
  });

  it('maps catalog legacy types onto seeded ratings and skips ratings without matched users', async () => {
    await expect(
      importLegacyRatingRows({
        members: [],
        ratingTypes: [
          {
            basic_opt: null,
            name: 'Learn-to-Sail 1',
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
      ...emptyCatalogReconcile(),
      ratingTypesImported: 1,
      userRatingsImported: 0,
      userRatingsSkipped: 1,
    });

    expect(mocks.sailingRatingUpdate).toHaveBeenCalledWith({
      where: { id: 'rating-tech' },
      data: { isDeprecated: false },
    });
    expect(mocks.sailingRatingUpsert).not.toHaveBeenCalled();
    expect(mocks.createMany).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      legacyImportTransactionOptions
    );
  });

  it('imports provisional legacy ratings and adds implied tech in the same batch', async () => {
    mocks.queryRaw.mockResolvedValue([
      { email: 'sailor@example.com', id: 'app-user-sailor' },
      { email: 'instructor@example.com', id: 'app-user-instructor' },
    ]);

    await expect(
      importLegacyRatingRows({
        members: [
          activeMember({
            email: 'sailor@example.com',
            first: 'Sally',
            id: 'sailor',
            last: 'Sailor',
          }),
          activeMember({
            email: 'instructor@example.com',
            first: 'Isaac',
            id: 'instructor',
            last: 'Instructor',
          }),
        ],
        ratingTypes: [
          {
            basic_opt: null,
            name: 'Provisional: MITNA',
            rank: '1',
            status: '1',
            type: '7',
          },
        ],
        ratings: [
          {
            basic: null,
            eval_date: '2026-01-01',
            eval_id: 'instructor',
            id: 'sailor',
            rating_type: '7',
          },
        ],
      })
    ).resolves.toEqual({
      ...emptyCatalogReconcile(),
      ratingTypesImported: 1,
      userRatingsImported: 2,
      userRatingsSkipped: 0,
    });

    expect(mocks.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          sailingRatingId: 'rating-provisional',
          userId: 'app-user-sailor',
        }),
        expect.objectContaining({
          sailingRatingId: 'rating-tech',
          userId: 'app-user-sailor',
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('imports user ratings for matched active members onto catalog ratings', async () => {
    mocks.queryRaw.mockResolvedValue([
      { email: 'sailor@example.com', id: 'app-user-sailor' },
      { email: 'instructor@example.com', id: 'app-user-instructor' },
    ]);

    await expect(
      importLegacyRatingRows({
        members: [
          activeMember({
            email: 'sailor@example.com',
            first: 'Sally',
            id: 'sailor',
            last: 'Sailor',
          }),
          activeMember({
            email: 'instructor@example.com',
            first: 'Isaac',
            id: 'instructor',
            last: 'Instructor',
          }),
        ],
        ratingTypes: [
          {
            basic_opt: null,
            name: 'Learn-to-Sail 1',
            rank: '1',
            status: '1',
            type: '2',
          },
        ],
        ratings: [
          {
            basic: null,
            eval_date: '2026-01-01',
            eval_id: 'instructor',
            id: 'sailor',
            rating_type: '2',
          },
          {
            basic: null,
            eval_date: 'not-a-date',
            eval_id: 'instructor',
            id: 'sailor',
            rating_type: '2',
          },
        ],
      })
    ).resolves.toEqual({
      ...emptyCatalogReconcile(),
      ratingTypesImported: 1,
      userRatingsImported: 1,
      userRatingsSkipped: 1,
    });

    expect(mocks.sailingRatingUpdate).toHaveBeenCalledOnce();
    expect(mocks.queryRaw).toHaveBeenCalledOnce();
    expect(mocks.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          issuedAt: new Date('2026-01-01T12:00:00.000Z'),
          issuedByUserId: 'app-user-instructor',
          sailingRatingId: 'rating-tech',
          userId: 'app-user-sailor',
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('creates legacy-only ratings when no catalog mapping exists', async () => {
    await expect(
      importLegacyRatingRows({
        members: [],
        ratingTypes: [
          {
            basic_opt: null,
            name: 'Coxswain',
            rank: '1',
            status: '1',
            type: '9',
          },
        ],
        ratings: [],
      })
    ).resolves.toEqual({
      ...emptyCatalogReconcile(),
      ratingTypesImported: 1,
      userRatingsImported: 0,
      userRatingsSkipped: 0,
    });

    expect(mocks.sailingRatingUpsert).toHaveBeenCalledOnce();
    expect(mocks.sailingRatingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ isVisible: false }),
        update: expect.objectContaining({ isVisible: false }),
      })
    );
    expect(mocks.sailingRatingUpdate).not.toHaveBeenCalled();
  });

  it('imports rating types, ratings, and members from mysql reader fixtures', async () => {
    const { createFixtureLegacyMysqlReader } =
      await import('@/libs/legacy-sync/legacyMysqlReader');
    const { importLegacyRatings } =
      await import('@/libs/legacy-sync/legacyRatingImport');
    const reader = createFixtureLegacyMysqlReader({
      ratingTypes: [
        {
          basic_opt: null,
          name: 'Learn-to-Sail 1',
          rank: '1',
          status: '1',
          type: '2',
        },
      ],
      ratings: [
        {
          basic: null,
          eval_date: '',
          eval_id: 'instructor',
          id: 'sailor',
          rating_type: '2',
        },
      ],
      activeMembers: [
        activeMember({
          email: 'sailor@example.com',
          first: 'Sally',
          id: 'sailor',
          last: 'Sailor',
        }),
      ],
    });

    await expect(importLegacyRatings(reader)).resolves.toEqual({
      ...emptyCatalogReconcile(),
      ratingTypesImported: 1,
      userRatingsImported: 0,
      userRatingsSkipped: 1,
    });

    expect(mocks.sailingRatingUpdate).toHaveBeenCalledOnce();
    expect(mocks.createMany).not.toHaveBeenCalled();
  });
});
