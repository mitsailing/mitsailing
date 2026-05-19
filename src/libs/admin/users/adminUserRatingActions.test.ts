import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@/libs/auth/permissions';

const mocks = vi.hoisted(() => {
  const tx = {
    userSailingRating: {
      create: vi.fn(),
    },
  };
  return {
    deleteMany: vi.fn(),
    redirect: vi.fn((href: string) => {
      throw new Error(`NEXT_REDIRECT:${href}`);
    }),
    requirePermission: vi.fn(),
    revalidatePath: vi.fn(),
    transaction: vi.fn(
      async (operation: (client: typeof tx) => Promise<unknown>) => {
        const result = await operation(tx);
        return result;
      }
    ),
    tx,
    userCanGrantSailingRating: vi.fn(),
  };
});

vi.mock('server-only', () => ({}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/libs/auth/dal', () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    $transaction: mocks.transaction,
    userSailingRating: {
      deleteMany: mocks.deleteMany,
    },
  },
}));

vi.mock('@/libs/mit-sailing/sailingRatingQueries', () => ({
  userCanGrantSailingRating: mocks.userCanGrantSailingRating,
}));

function ratingFormData(ratingId: string): FormData {
  const formData = new FormData();
  formData.set('sailingRatingId', ratingId);
  return formData;
}

beforeEach(() => {
  mocks.deleteMany.mockReset();
  mocks.redirect.mockClear();
  mocks.requirePermission.mockReset();
  mocks.revalidatePath.mockClear();
  mocks.transaction.mockClear();
  mocks.tx.userSailingRating.create.mockReset();
  mocks.userCanGrantSailingRating.mockReset();

  mocks.requirePermission.mockResolvedValue({
    user: { id: 'admin-1', role: 'admin' },
  });
  mocks.userCanGrantSailingRating.mockResolvedValue({ eligible: true });
});

describe('admin user rating actions', () => {
  it('grants ratings and revalidates the current user page without redirecting', async () => {
    const { grantAdminUserRatingAction } =
      await import('@/libs/admin/users/adminUserRatingActions');

    await expect(
      grantAdminUserRatingAction(
        { locale: 'en', userId: 'username' },
        ratingFormData('rating-tech')
      )
    ).resolves.toBeUndefined();

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.RATINGS_ASSIGN,
      'en'
    );
    expect(mocks.userCanGrantSailingRating).toHaveBeenCalledWith(
      { ratingId: 'rating-tech', userId: 'username' },
      { client: mocks.tx }
    );
    expect(mocks.tx.userSailingRating.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        issuedByUserId: 'admin-1',
        sailingRatingId: 'rating-tech',
        userId: 'username',
      }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      '/admin/users/username',
      'page'
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('revokes ratings and revalidates the current user page without redirecting', async () => {
    const { revokeAdminUserRatingAction } =
      await import('@/libs/admin/users/adminUserRatingActions');

    await expect(
      revokeAdminUserRatingAction(
        { locale: 'en', userId: 'username' },
        ratingFormData('rating-tech')
      )
    ).resolves.toBeUndefined();

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.RATINGS_ASSIGN,
      'en'
    );
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: {
        sailingRatingId: 'rating-tech',
        userId: 'username',
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      '/admin/users/username',
      'page'
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
