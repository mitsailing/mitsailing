import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cmsMenuFindMany: vi.fn(),
  cmsMenuItemFindMany: vi.fn(),
  cmsPageBlockCreate: vi.fn(),
  cmsPageBlockFindUnique: vi.fn(),
  cmsPageBlockFindMany: vi.fn(),
  cmsPageBlockUpdate: vi.fn(),
  cmsPageFindUnique: vi.fn(),
  cmsPageFindMany: vi.fn(),
  cmsPageUpdate: vi.fn(),
  cmsPageRevisionAggregate: vi.fn(),
  cmsPageRevisionCreate: vi.fn(),
  cmsPageRevisionFindFirst: vi.fn(),
  prismaTransaction: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    cmsMenu: {
      findMany: mocks.cmsMenuFindMany,
    },
    cmsMenuItem: {
      findMany: mocks.cmsMenuItemFindMany,
    },
    cmsPage: {
      findMany: mocks.cmsPageFindMany,
      findUnique: mocks.cmsPageFindUnique,
      update: mocks.cmsPageUpdate,
    },
    cmsPageBlock: {
      create: mocks.cmsPageBlockCreate,
      findUnique: mocks.cmsPageBlockFindUnique,
      findMany: mocks.cmsPageBlockFindMany,
      update: mocks.cmsPageBlockUpdate,
    },
    cmsPageRevision: {
      aggregate: mocks.cmsPageRevisionAggregate,
      create: mocks.cmsPageRevisionCreate,
      findFirst: mocks.cmsPageRevisionFindFirst,
    },
    $transaction: mocks.prismaTransaction,
  },
}));

const {
  cmsMenuItemsCatalogHandlers,
  cmsMenuParentSelectOptions,
  cmsPagesCatalogHandlers,
  cmsPageBlocksCatalogHandlers,
} = await import('@/libs/admin/catalog/cmsCatalogHandlers');
const {
  catalogListOptionsForScope,
  catalogScopedCreatePath,
  catalogScopedListState,
} = await import('@/libs/admin/catalog/scopedCatalogLists');

beforeEach(() => {
  mocks.cmsMenuFindMany.mockReset();
  mocks.cmsMenuItemFindMany.mockReset();
  mocks.cmsPageBlockCreate.mockReset();
  mocks.cmsPageBlockFindUnique.mockReset();
  mocks.cmsPageBlockFindMany.mockReset();
  mocks.cmsPageBlockUpdate.mockReset();
  mocks.cmsPageFindUnique.mockReset();
  mocks.cmsPageFindMany.mockReset();
  mocks.cmsPageUpdate.mockReset();
  mocks.cmsPageRevisionAggregate.mockReset();
  mocks.cmsPageRevisionCreate.mockReset();
  mocks.cmsPageRevisionFindFirst.mockReset();
  mocks.prismaTransaction.mockReset();
  mocks.prismaTransaction.mockImplementation(
    async (transactionBody: (tx: unknown) => Promise<unknown>) => {
      const result = await transactionBody({
        cmsPageRevision: {
          aggregate: mocks.cmsPageRevisionAggregate,
          create: mocks.cmsPageRevisionCreate,
          findFirst: mocks.cmsPageRevisionFindFirst,
        },
      });
      return result;
    }
  );
});

function cmsPageSnapshotRow(now: Date) {
  return {
    id: 'page-1',
    slug: 'about',
    path: '/about/',
    title: 'About',
    metaTitle: 'About',
    metaDescription: 'About page',
    isPublished: true,
    createdAt: now,
    updatedAt: now,
    blocks: [
      {
        id: 'block-1',
        kind: 'text_section',
        title: 'Overview',
        subtitle: null,
        body: '<p>Plain body</p>',
        ctaLabel: null,
        ctaUrl: null,
        imageSrc: null,
        imageAlt: null,
        displayOrder: 10,
        isVisible: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

describe('cmsPagesCatalogHandlers', () => {
  describe('updateFromForm', () => {
    it('skips history when page content is unchanged', async () => {
      const now = new Date('2026-05-09T12:00:00.000Z');
      const formData = new FormData();
      formData.set('slug', 'about');
      formData.set('path', '/about/');
      formData.set('title', 'About');
      formData.set('metaTitle', 'About');
      formData.set('metaDescription', 'About page');
      formData.set('isPublished', 'true');

      mocks.cmsPageFindUnique.mockResolvedValue(cmsPageSnapshotRow(now));
      mocks.cmsPageUpdate.mockResolvedValue({ id: 'page-1' });

      await expect(
        cmsPagesCatalogHandlers.updateFromForm('page-1', formData, {
          userId: 'admin-1',
        })
      ).resolves.toEqual({ ok: true });

      expect(mocks.cmsPageRevisionCreate).not.toHaveBeenCalled();
      expect(mocks.cmsPageRevisionFindFirst).not.toHaveBeenCalled();
    });
  });
});

describe('cmsPageBlocksCatalogHandlers', () => {
  describe('list', () => {
    it('returns blocks for the requested page', async () => {
      mocks.cmsPageBlockFindMany.mockResolvedValue([
        {
          displayOrder: 10,
          id: 'block-2',
          isVisible: true,
          kind: 'text_section',
          title: 'Overview',
        },
      ]);

      await expect(
        cmsPageBlocksCatalogHandlers.list({ pageId: 'page-2' })
      ).resolves.toEqual([
        {
          displayOrder: 10,
          id: 'block-2',
          isVisible: true,
          kind: 'text_section',
          title: 'Overview',
        },
      ]);
      expect(mocks.cmsPageBlockFindMany).toHaveBeenCalledWith({
        orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }, { id: 'asc' }],
        select: {
          displayOrder: true,
          id: true,
          isVisible: true,
          kind: true,
          title: true,
        },
        where: { pageId: 'page-2' },
      });
    });

    it('returns no rows without a page scope', async () => {
      await expect(cmsPageBlocksCatalogHandlers.list()).resolves.toEqual([]);
      expect(mocks.cmsPageBlockFindMany).not.toHaveBeenCalled();
    });
  });

  describe('createFromForm', () => {
    it('records page history after block creation', async () => {
      const now = new Date('2026-05-09T12:00:00.000Z');
      const formData = new FormData();
      formData.set('pageId', 'page-1');
      formData.set('kind', 'text_section');
      formData.set('title', 'Overview');
      formData.set('body', 'Plain body');
      formData.set('displayOrder', '10');
      formData.set('isVisible', 'true');

      mocks.cmsPageBlockCreate.mockResolvedValue({ id: 'block-1' });
      mocks.cmsPageFindUnique.mockResolvedValue({
        id: 'page-1',
        slug: 'about',
        path: '/about/',
        title: 'About',
        metaTitle: null,
        metaDescription: null,
        isPublished: true,
        createdAt: now,
        updatedAt: now,
        blocks: [
          {
            id: 'block-1',
            kind: 'text_section',
            title: 'Overview',
            subtitle: null,
            body: '<p>Plain body</p>',
            ctaLabel: null,
            ctaUrl: null,
            imageSrc: null,
            imageAlt: null,
            displayOrder: 10,
            isVisible: true,
            createdAt: now,
            updatedAt: now,
          },
        ],
      });
      mocks.cmsPageRevisionFindFirst.mockResolvedValue({
        snapshot: {
          page: {
            id: 'page-1',
            slug: 'about',
            path: '/about/',
            title: 'About',
            metaTitle: null,
            metaDescription: null,
            isPublished: true,
          },
          blocks: [],
        },
        version: 2,
      });
      mocks.cmsPageRevisionCreate.mockResolvedValue({ id: 'revision-3' });

      await expect(
        cmsPageBlocksCatalogHandlers.createFromForm(formData, {
          userId: 'admin-1',
        })
      ).resolves.toEqual({ ok: true, id: 'block-1' });

      expect(mocks.prismaTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: 'Serializable' }
      );
      expect(mocks.cmsPageRevisionCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'update',
          createdByUserId: 'admin-1',
          pageId: 'page-1',
          version: 3,
          snapshot: expect.objectContaining({
            blocks: [
              expect.objectContaining({
                body: '<p>Plain body</p>',
                id: 'block-1',
              }),
            ],
          }),
        }),
      });
    });
  });
});

describe('cmsMenuItemsCatalogHandlers', () => {
  describe('list', () => {
    it('returns menu items for the selected menu', async () => {
      mocks.cmsMenuItemFindMany.mockResolvedValue([
        {
          displayOrder: 1,
          id: 'item-1',
          isVisible: true,
          label: 'About',
          linkedPage: { path: '/about' },
          menu: { location: 'header', title: 'Header' },
          menuId: 'menu-1',
          parent: null,
          parentId: null,
          systemKey: null,
          url: null,
        },
      ]);

      await expect(
        cmsMenuItemsCatalogHandlers.list({ menuId: 'menu-1' })
      ).resolves.toMatchObject([{ id: 'item-1', label: 'About' }]);
      expect(mocks.cmsMenuItemFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { menuId: 'menu-1' } })
      );
    });
  });

  describe('parent options', () => {
    it('limits parent menu item options to the current menu', async () => {
      mocks.cmsMenuItemFindMany.mockResolvedValue([
        {
          displayOrder: 1,
          id: 'parent-1',
          isVisible: true,
          label: 'About',
          linkedPage: null,
          menu: { location: 'header', title: 'Header' },
          menuId: 'menu-1',
          parent: null,
          parentId: null,
          systemKey: null,
          url: '/about',
        },
      ]);

      await expect(
        cmsMenuParentSelectOptions({ excludeId: 'item-1', menuId: 'menu-1' })
      ).resolves.toEqual([
        { label: 'No parent', value: '' },
        { label: 'About', value: 'parent-1' },
      ]);
      expect(mocks.cmsMenuItemFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { not: 'item-1' }, menuId: 'menu-1' },
        })
      );
    });
  });
});

describe('catalogScopedListState', () => {
  it('defaults missing and invalid page scopes to the first page', async () => {
    mocks.cmsPageFindMany.mockResolvedValue([
      { id: 'page-1', path: '/about', title: 'About' },
      { id: 'page-2', path: '/contact', title: 'Contact' },
    ]);

    const state = await catalogScopedListState({
      resourceId: 'cms_page_blocks',
      searchParams: { page: 'missing-page' },
    });

    expect(state?.selectedValue).toBe('page-1');
    expect(catalogListOptionsForScope(state)).toEqual({ pageId: 'page-1' });
    expect(
      catalogScopedCreatePath({
        basePath: '/admin/cms_page_blocks/new',
        state,
      })
    ).toBe('/admin/cms_page_blocks/new?page=page-1');
  });

  it('keeps an empty scope when no parent records exist', async () => {
    mocks.cmsPageFindMany.mockResolvedValue([]);

    const state = await catalogScopedListState({
      resourceId: 'cms_page_blocks',
      searchParams: {},
    });

    expect(state?.selectedValue).toBe('');
    expect(catalogListOptionsForScope(state)).toEqual({});
    expect(
      catalogScopedCreatePath({
        basePath: '/admin/cms_page_blocks/new',
        state,
      })
    ).toBe('/admin/cms_page_blocks/new');
  });

  it('merges scoped create params into existing query strings', async () => {
    mocks.cmsPageFindMany.mockResolvedValue([
      { id: 'page-2', path: '/contact', title: 'Contact' },
    ]);

    const state = await catalogScopedListState({
      resourceId: 'cms_page_blocks',
      searchParams: { page: 'page-2' },
    });

    expect(
      catalogScopedCreatePath({
        basePath: '/admin/cms_page_blocks/new?menu=open',
        state,
      })
    ).toBe('/admin/cms_page_blocks/new?menu=open&page=page-2');
  });
});
