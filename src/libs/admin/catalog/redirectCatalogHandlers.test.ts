import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  legacyRedirectCreate: vi.fn(),
  legacyRedirectDelete: vi.fn(),
  legacyRedirectFindMany: vi.fn(),
  legacyRedirectFindUnique: vi.fn(),
  legacyRedirectUpdate: vi.fn(),
  publicSlugDelete: vi.fn(),
  publicSlugFindMany: vi.fn(),
  publicSlugFindUnique: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    legacyRedirect: {
      create: mocks.legacyRedirectCreate,
      delete: mocks.legacyRedirectDelete,
      findMany: mocks.legacyRedirectFindMany,
      findUnique: mocks.legacyRedirectFindUnique,
      update: mocks.legacyRedirectUpdate,
    },
    publicSlug: {
      delete: mocks.publicSlugDelete,
      findMany: mocks.publicSlugFindMany,
      findUnique: mocks.publicSlugFindUnique,
    },
  },
}));

const { legacyRedirectsCatalogHandlers, publicSlugsCatalogHandlers } =
  await import('@/libs/admin/catalog/redirectCatalogHandlers');

beforeEach(() => {
  for (const mock of Object.values(mocks)) {
    mock.mockReset();
  }
});

function legacyRedirectFormData(props: {
  sourcePath: string;
  targetPath: string;
  source?: string;
}): FormData {
  const formData = new FormData();
  formData.set('sourcePath', props.sourcePath);
  formData.set('targetPath', props.targetPath);
  formData.set('source', props.source ?? 'manual');
  return formData;
}

describe('publicSlugsCatalogHandlers', () => {
  it('lists public slugs with target paths', async () => {
    const createdAt = new Date('2026-05-20T12:00:00.000Z');
    mocks.publicSlugFindMany.mockResolvedValue([
      {
        createdAt,
        id: 'slug-1',
        scope: 'classes',
        slug: 'intro',
        sluggableId: 'class-1',
        sluggableType: 'SailingClass',
        source: 'automatic',
      },
    ]);

    await expect(publicSlugsCatalogHandlers.list()).resolves.toEqual([
      {
        createdAt: createdAt.toISOString(),
        id: 'slug-1',
        scope: 'classes',
        slug: 'intro',
        sluggableId: 'class-1',
        sluggableType: 'SailingClass',
        source: 'automatic',
        targetPath: '/classes/intro',
      },
    ]);
  });

  it('blocks public slug create and update handlers', async () => {
    await expect(
      publicSlugsCatalogHandlers.createFromForm(new FormData())
    ).resolves.toEqual({ ok: false, code: 'unsupported' });
    await expect(
      publicSlugsCatalogHandlers.updateFromForm('slug-1', new FormData())
    ).resolves.toEqual({ ok: false, code: 'unsupported' });
  });

  it('deletes public slug rows', async () => {
    mocks.publicSlugDelete.mockResolvedValue({ id: 'slug-1' });

    await expect(publicSlugsCatalogHandlers.delete('slug-1')).resolves.toEqual({
      ok: true,
    });

    expect(mocks.publicSlugDelete).toHaveBeenCalledWith({
      where: { id: 'slug-1' },
    });
  });
});

describe('legacyRedirectsCatalogHandlers', () => {
  it('creates legacy redirects from valid paths', async () => {
    mocks.legacyRedirectCreate.mockResolvedValue({ id: 'redirect-1' });

    await expect(
      legacyRedirectsCatalogHandlers.createFromForm(
        legacyRedirectFormData({
          sourcePath: '/old-page.php',
          targetPath: '/classes/intro',
        })
      )
    ).resolves.toEqual({ ok: true, id: 'redirect-1' });

    expect(mocks.legacyRedirectCreate).toHaveBeenCalledWith({
      data: {
        source: 'manual',
        sourcePath: '/old-page.php',
        targetPath: '/classes/intro',
      },
      select: { id: true },
    });
  });

  it('rejects unsupported source and target paths', async () => {
    await expect(
      legacyRedirectsCatalogHandlers.createFromForm(
        legacyRedirectFormData({
          sourcePath: '/old-page.asp',
          targetPath: '/api/events',
        })
      )
    ).resolves.toEqual({ ok: false, code: 'validation_failed' });

    expect(mocks.legacyRedirectCreate).not.toHaveBeenCalled();
  });

  it('updates and deletes legacy redirect rows', async () => {
    mocks.legacyRedirectUpdate.mockResolvedValue({ id: 'redirect-1' });
    mocks.legacyRedirectDelete.mockResolvedValue({ id: 'redirect-1' });

    await expect(
      legacyRedirectsCatalogHandlers.updateFromForm(
        'redirect-1',
        legacyRedirectFormData({
          source: 'ai_migration',
          sourcePath: '/old-page.html',
          targetPath: '/about',
        })
      )
    ).resolves.toEqual({ ok: true });
    await expect(
      legacyRedirectsCatalogHandlers.delete('redirect-1')
    ).resolves.toEqual({ ok: true });

    expect(mocks.legacyRedirectUpdate).toHaveBeenCalledWith({
      data: {
        source: 'ai_migration',
        sourcePath: '/old-page.html',
        targetPath: '/about',
      },
      where: { id: 'redirect-1' },
    });
    expect(mocks.legacyRedirectDelete).toHaveBeenCalledWith({
      where: { id: 'redirect-1' },
    });
  });
});
