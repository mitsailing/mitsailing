import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createMany: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    publicSlug: {
      createMany: mocks.createMany,
      deleteMany: mocks.deleteMany,
    },
  },
}));

describe('publicSlugHistory', () => {
  beforeEach(() => {
    mocks.createMany.mockReset();
    mocks.deleteMany.mockReset();
  });

  it('records previous aliases and removes aliases matching the new canonical value', async () => {
    const { recordPublicSlugHistory } =
      await import('@/libs/mit-sailing/publicSlugHistory');

    await recordPublicSlugHistory({
      currentSlug: 'new-path',
      previousSlug: 'old-path',
      scope: 'classes',
      sluggableId: 'class-1',
      sluggableType: 'SailingClass',
    });

    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: {
        scope: 'classes',
        slug: 'new-path',
        sluggableId: 'class-1',
        sluggableType: 'SailingClass',
      },
    });
    expect(mocks.createMany).toHaveBeenCalledWith({
      data: [
        {
          scope: 'classes',
          slug: 'old-path',
          sluggableId: 'class-1',
          sluggableType: 'SailingClass',
          source: 'automatic',
        },
      ],
      skipDuplicates: true,
    });
  });

  it('does not create history when the public value is unchanged', async () => {
    const { recordPublicSlugHistory } =
      await import('@/libs/mit-sailing/publicSlugHistory');

    await recordPublicSlugHistory({
      currentSlug: 'same-path',
      previousSlug: 'same-path',
      scope: 'cms',
      sluggableId: 'page-1',
      sluggableType: 'CmsPage',
    });

    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: {
        scope: 'cms',
        slug: 'same-path',
        sluggableId: 'page-1',
        sluggableType: 'CmsPage',
      },
    });
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it('deletes history by sluggable target', async () => {
    const { deletePublicSlugHistoryForTarget } =
      await import('@/libs/mit-sailing/publicSlugHistory');

    await deletePublicSlugHistoryForTarget({
      sluggableId: 'boat-1',
      sluggableType: 'FleetBoat',
    });

    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: {
        sluggableId: 'boat-1',
        sluggableType: 'FleetBoat',
      },
    });
  });
});
