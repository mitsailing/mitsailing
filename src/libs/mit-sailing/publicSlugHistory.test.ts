import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createMany: vi.fn(),
  deleteMany: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    publicSlug: {
      createMany: mocks.createMany,
      deleteMany: mocks.deleteMany,
      upsert: mocks.upsert,
    },
  },
}));

describe('publicSlugHistory', () => {
  beforeEach(() => {
    mocks.createMany.mockReset();
    mocks.deleteMany.mockReset();
    mocks.upsert.mockReset();
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
        sluggableType: 'SailingClass',
      },
    });
    expect(mocks.upsert).toHaveBeenCalledWith({
      create: {
        scope: 'classes',
        slug: 'old-path',
        sluggableId: 'class-1',
        sluggableType: 'SailingClass',
        source: 'automatic',
      },
      update: {
        sluggableId: 'class-1',
        source: 'automatic',
      },
      where: {
        slug_sluggableType_scope: {
          scope: 'classes',
          slug: 'old-path',
          sluggableType: 'SailingClass',
        },
      },
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
        sluggableType: 'CmsPage',
      },
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('reassigns reused previous aliases to the latest target', async () => {
    const { recordPublicSlugHistory } =
      await import('@/libs/mit-sailing/publicSlugHistory');

    await recordPublicSlugHistory({
      currentSlug: 'new-event',
      previousSlug: 'reused-event',
      scope: 'events',
      sluggableId: 'event-2',
      sluggableType: 'Event',
    });

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          sluggableId: 'event-2',
          source: 'automatic',
        },
        where: {
          slug_sluggableType_scope: {
            scope: 'events',
            slug: 'reused-event',
            sluggableType: 'Event',
          },
        },
      })
    );
  });

  it('removes stale aliases matching a reused canonical value across targets', async () => {
    const { recordPublicSlugHistory } =
      await import('@/libs/mit-sailing/publicSlugHistory');

    await recordPublicSlugHistory({
      currentSlug: 'reused-path',
      previousSlug: 'old-path',
      scope: 'events',
      sluggableId: 'event-2',
      sluggableType: 'Event',
    });

    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: {
        scope: 'events',
        slug: 'reused-path',
        sluggableType: 'Event',
      },
    });
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
