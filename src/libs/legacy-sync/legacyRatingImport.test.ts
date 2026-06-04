import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LegacyMemberRow } from '@/libs/legacy-sync/legacyPaymentImport';
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

  it('imports user ratings for matched active members', async () => {
    mocks.userFindMany.mockResolvedValue([
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
      ratingTypesImported: 1,
      userRatingsImported: 1,
      userRatingsSkipped: 1,
    });

    expect(mocks.sailingRatingUpsert).toHaveBeenCalledOnce();
    expect(mocks.userFindMany).toHaveBeenCalledWith({
      select: { email: true, id: true },
      where: {
        email: {
          in: expect.arrayContaining([
            'sailor@example.com',
            'instructor@example.com',
          ]),
        },
      },
    });
    expect(mocks.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          issuedAt: new Date('2026-01-01T12:00:00.000Z'),
          issuedByUserId: 'app-user-instructor',
          sailingRatingId: 'rating-1',
          userId: 'app-user-sailor',
        }),
      ],
      skipDuplicates: true,
    });
  });
});
