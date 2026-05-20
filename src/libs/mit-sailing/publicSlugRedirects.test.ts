import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cmsPageFindUnique: vi.fn(),
  eventFindUnique: vi.fn(),
  fleetBoatFindUnique: vi.fn(),
  publicSlugFindFirst: vi.fn(),
  sailingClassFindUnique: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/Env', () => ({
  Env: {
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    cmsPage: {
      findUnique: mocks.cmsPageFindUnique,
    },
    event: {
      findUnique: mocks.eventFindUnique,
    },
    fleetBoat: {
      findUnique: mocks.fleetBoatFindUnique,
    },
    publicSlug: {
      findFirst: mocks.publicSlugFindFirst,
    },
    sailingClass: {
      findUnique: mocks.sailingClassFindUnique,
    },
  },
}));

describe('publicSlugRedirects', () => {
  beforeEach(() => {
    mocks.cmsPageFindUnique.mockReset();
    mocks.eventFindUnique.mockReset();
    mocks.fleetBoatFindUnique.mockReset();
    mocks.publicSlugFindFirst.mockReset();
    mocks.sailingClassFindUnique.mockReset();
  });

  it('returns event canonical paths for published history targets', async () => {
    mocks.publicSlugFindFirst.mockResolvedValue({
      sluggableId: 'event-1',
      sluggableType: 'Event',
    });
    mocks.eventFindUnique.mockResolvedValue({
      isPublished: true,
      slug: 'new-event',
    });

    const { resolvePublicSlugRedirect } =
      await import('@/libs/mit-sailing/publicSlugRedirects');

    await expect(
      resolvePublicSlugRedirect({
        locale: 'en',
        scope: 'events',
        slug: 'old-event',
      })
    ).resolves.toBe('/events/new-event');
    expect(mocks.publicSlugFindFirst).toHaveBeenCalledWith({
      select: {
        sluggableId: true,
        sluggableType: true,
      },
      where: {
        scope: 'events',
        slug: 'old-event',
      },
    });
    expect(mocks.eventFindUnique).toHaveBeenCalledWith({
      select: { slug: true },
      where: { id: 'event-1', isPublished: true },
    });
  });

  it('returns null for hidden class history targets', async () => {
    mocks.publicSlugFindFirst.mockResolvedValue({
      sluggableId: 'class-1',
      sluggableType: 'SailingClass',
    });
    mocks.sailingClassFindUnique.mockResolvedValue(null);

    const { resolvePublicSlugRedirect } =
      await import('@/libs/mit-sailing/publicSlugRedirects');

    await expect(
      resolvePublicSlugRedirect({
        locale: 'en',
        scope: 'classes',
        slug: 'old-class',
      })
    ).resolves.toBeNull();
    expect(mocks.sailingClassFindUnique).toHaveBeenCalledWith({
      select: { slug: true },
      where: { id: 'class-1', isVisible: true },
    });
  });

  it('returns cms canonical paths without default locale prefixes', async () => {
    mocks.publicSlugFindFirst.mockResolvedValue({
      sluggableId: 'page-1',
      sluggableType: 'CmsPage',
    });
    mocks.cmsPageFindUnique.mockResolvedValue({
      path: '/about/visit',
    });

    const { resolvePublicSlugRedirect } =
      await import('@/libs/mit-sailing/publicSlugRedirects');

    await expect(
      resolvePublicSlugRedirect({
        locale: 'en',
        scope: 'cms',
        slug: '/about-us',
      })
    ).resolves.toBe('/about/visit');
    expect(mocks.cmsPageFindUnique).toHaveBeenCalledWith({
      select: { path: true },
      where: { id: 'page-1', isPublished: true },
    });
  });

  it('returns fleet canonical paths for boat history targets', async () => {
    mocks.publicSlugFindFirst.mockResolvedValue({
      sluggableId: 'boat-1',
      sluggableType: 'FleetBoat',
    });
    mocks.fleetBoatFindUnique.mockResolvedValue({
      slug: 'new-boat',
    });

    const { resolvePublicSlugRedirect } =
      await import('@/libs/mit-sailing/publicSlugRedirects');

    await expect(
      resolvePublicSlugRedirect({
        locale: 'en',
        scope: 'fleet',
        slug: 'old-boat',
      })
    ).resolves.toBe('/fleet/new-boat');
    expect(mocks.fleetBoatFindUnique).toHaveBeenCalledWith({
      select: { slug: true },
      where: { id: 'boat-1' },
    });
  });

  it('returns null when history already points at the requested slug', async () => {
    mocks.publicSlugFindFirst.mockResolvedValue({
      sluggableId: 'event-1',
      sluggableType: 'Event',
    });
    mocks.eventFindUnique.mockResolvedValue({
      slug: 'same-event',
    });

    const { resolvePublicSlugRedirect } =
      await import('@/libs/mit-sailing/publicSlugRedirects');

    await expect(
      resolvePublicSlugRedirect({
        locale: 'en',
        scope: 'events',
        slug: 'same-event',
      })
    ).resolves.toBeNull();
  });

  it('redirects when the canonical target has the same slug in another scope', async () => {
    mocks.publicSlugFindFirst.mockResolvedValue({
      sluggableId: 'event-1',
      sluggableType: 'Event',
    });
    mocks.eventFindUnique.mockResolvedValue({
      slug: 'shared-slug',
    });

    const { resolvePublicSlugRedirect } =
      await import('@/libs/mit-sailing/publicSlugRedirects');

    await expect(
      resolvePublicSlugRedirect({
        locale: 'en',
        scope: 'classes',
        slug: 'shared-slug',
      })
    ).resolves.toBe('/events/shared-slug');
  });
});
