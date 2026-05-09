import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cmsMenuFindMany: vi.fn(),
  cmsMenuItemFindMany: vi.fn(),
  cmsPageBlockFindMany: vi.fn(),
  cmsPageFindMany: vi.fn(),
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
    },
    cmsPageBlock: {
      findMany: mocks.cmsPageBlockFindMany,
    },
  },
}));

const {
  cmsMenuItemsCatalogHandlers,
  cmsMenuParentSelectOptions,
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
  mocks.cmsPageBlockFindMany.mockReset();
  mocks.cmsPageFindMany.mockReset();
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
});
