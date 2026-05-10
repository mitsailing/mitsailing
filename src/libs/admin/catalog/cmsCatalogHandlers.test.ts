import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cmsMenuItemAggregate: vi.fn(),
  cmsMenuItemCreate: vi.fn(),
  cmsMenuFindMany: vi.fn(),
  cmsMenuItemFindMany: vi.fn(),
  cmsMenuItemUpdate: vi.fn(),
  cmsPageBlockAggregate: vi.fn(),
  cmsPageBlockCreate: vi.fn(),
  cmsPageBlockFindUnique: vi.fn(),
  cmsPageBlockFindMany: vi.fn(),
  cmsPageBlockUpdate: vi.fn(),
  cmsPageFindUnique: vi.fn(),
  cmsPageFindMany: vi.fn(),
  cmsPageUpdate: vi.fn(),
  userAuditAggregate: vi.fn(),
  userAuditCreate: vi.fn(),
  userAuditFindFirst: vi.fn(),
  prismaTransaction: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    cmsMenu: {
      findMany: mocks.cmsMenuFindMany,
    },
    cmsMenuItem: {
      aggregate: mocks.cmsMenuItemAggregate,
      create: mocks.cmsMenuItemCreate,
      findMany: mocks.cmsMenuItemFindMany,
      update: mocks.cmsMenuItemUpdate,
    },
    cmsPage: {
      findMany: mocks.cmsPageFindMany,
      findUnique: mocks.cmsPageFindUnique,
      update: mocks.cmsPageUpdate,
    },
    cmsPageBlock: {
      aggregate: mocks.cmsPageBlockAggregate,
      create: mocks.cmsPageBlockCreate,
      findUnique: mocks.cmsPageBlockFindUnique,
      findMany: mocks.cmsPageBlockFindMany,
      update: mocks.cmsPageBlockUpdate,
    },
    userAudit: {
      aggregate: mocks.userAuditAggregate,
      create: mocks.userAuditCreate,
      findFirst: mocks.userAuditFindFirst,
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
  mocks.cmsMenuItemAggregate.mockReset();
  mocks.cmsMenuItemCreate.mockReset();
  mocks.cmsMenuFindMany.mockReset();
  mocks.cmsMenuItemFindMany.mockReset();
  mocks.cmsMenuItemUpdate.mockReset();
  mocks.cmsPageBlockAggregate.mockReset();
  mocks.cmsPageBlockCreate.mockReset();
  mocks.cmsPageBlockFindUnique.mockReset();
  mocks.cmsPageBlockFindMany.mockReset();
  mocks.cmsPageBlockUpdate.mockReset();
  mocks.cmsPageFindUnique.mockReset();
  mocks.cmsPageFindMany.mockReset();
  mocks.cmsPageUpdate.mockReset();
  mocks.userAuditAggregate.mockReset();
  mocks.userAuditCreate.mockReset();
  mocks.userAuditFindFirst.mockReset();
  mocks.prismaTransaction.mockReset();
  mocks.prismaTransaction.mockImplementation(
    async (transactionBody: (tx: unknown) => Promise<unknown>) => {
      const result = await transactionBody({
        userAudit: {
          aggregate: mocks.userAuditAggregate,
          create: mocks.userAuditCreate,
          findFirst: mocks.userAuditFindFirst,
        },
        cmsPageBlock: {
          update: mocks.cmsPageBlockUpdate,
        },
        cmsMenuItem: {
          update: mocks.cmsMenuItemUpdate,
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

      expect(mocks.userAuditCreate).not.toHaveBeenCalled();
      expect(mocks.userAuditFindFirst).not.toHaveBeenCalled();
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
      formData.set('isVisible', 'true');

      mocks.cmsPageBlockAggregate.mockResolvedValue({
        _max: { displayOrder: 9 },
      });
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
      mocks.userAuditFindFirst.mockResolvedValue({
        auditedChanges: {
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
      mocks.userAuditCreate.mockResolvedValue({ id: 'revision-3' });

      await expect(
        cmsPageBlocksCatalogHandlers.createFromForm(formData, {
          userId: 'admin-1',
        })
      ).resolves.toEqual({ ok: true, id: 'block-1' });

      expect(mocks.cmsPageBlockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          displayOrder: 10,
          pageId: 'page-1',
          title: 'Overview',
        }),
        select: { id: true },
      });
      expect(mocks.prismaTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: 'Serializable' }
      );
      expect(mocks.userAuditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'update',
          auditableId: 'page-1',
          auditableType: 'cms_pages',
          userId: 'admin-1',
          version: 3,
          auditedChanges: expect.objectContaining({
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

    it('appends new blocks after the current page order', async () => {
      const formData = new FormData();
      formData.set('pageId', 'page-1');
      formData.set('kind', 'text_section');
      formData.set('title', 'Schedule');
      formData.set('isVisible', 'true');

      mocks.cmsPageBlockAggregate.mockResolvedValue({
        _max: { displayOrder: 41 },
      });
      mocks.cmsPageBlockCreate.mockResolvedValue({ id: 'block-2' });
      mocks.cmsPageFindUnique.mockResolvedValue(null);

      await expect(
        cmsPageBlocksCatalogHandlers.createFromForm(formData)
      ).resolves.toEqual({ ok: true, id: 'block-2' });

      expect(mocks.cmsPageBlockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ displayOrder: 42 }),
        select: { id: true },
      });
    });
  });

  describe('updateFromForm', () => {
    it('preserves display order when editing the same page', async () => {
      const now = new Date('2026-05-09T12:00:00.000Z');
      const formData = new FormData();
      formData.set('pageId', 'page-1');
      formData.set('kind', 'text_section');
      formData.set('title', 'Overview');
      formData.set('isVisible', 'true');

      mocks.cmsPageBlockFindUnique.mockResolvedValue({ pageId: 'page-1' });
      mocks.cmsPageBlockUpdate.mockResolvedValue({ pageId: 'page-1' });
      mocks.cmsPageFindUnique.mockResolvedValue(cmsPageSnapshotRow(now));

      await expect(
        cmsPageBlocksCatalogHandlers.updateFromForm('block-1', formData)
      ).resolves.toEqual({ ok: true });

      expect(mocks.cmsPageBlockAggregate).not.toHaveBeenCalled();
      expect(mocks.cmsPageBlockUpdate).toHaveBeenCalledWith({
        data: expect.not.objectContaining({ displayOrder: expect.any(Number) }),
        select: { pageId: true },
        where: { id: 'block-1' },
      });
    });

    it('clears optional block fields when form values are empty', async () => {
      const now = new Date('2026-05-09T12:00:00.000Z');
      const formData = new FormData();
      formData.set('pageId', 'page-1');
      formData.set('kind', 'hero');
      formData.set('title', 'Hero');
      formData.set('imageSrc', '');
      formData.set('imageAlt', '');
      formData.set('ctaLabel', '');
      formData.set('ctaUrl', '');
      formData.set('isVisible', 'true');

      mocks.cmsPageBlockFindUnique.mockResolvedValue({ pageId: 'page-1' });
      mocks.cmsPageBlockUpdate.mockResolvedValue({ pageId: 'page-1' });
      mocks.cmsPageFindUnique.mockResolvedValue(cmsPageSnapshotRow(now));

      await expect(
        cmsPageBlocksCatalogHandlers.updateFromForm('block-1', formData)
      ).resolves.toEqual({ ok: true });

      expect(mocks.cmsPageBlockUpdate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ctaLabel: null,
          ctaUrl: null,
          imageAlt: null,
          imageSrc: null,
        }),
        select: { pageId: true },
        where: { id: 'block-1' },
      });
    });

    it('persists uploaded block image fields with alt text', async () => {
      const now = new Date('2026-05-09T12:00:00.000Z');
      const formData = new FormData();
      formData.set('pageId', 'page-1');
      formData.set('kind', 'hero');
      formData.set('title', 'Hero');
      formData.set('imageSrc', '/cms-media/asset-5/hero.png');
      formData.set('imageAlt', 'Sailboats on the Charles');
      formData.set('isVisible', 'true');

      mocks.cmsPageBlockFindUnique.mockResolvedValue({ pageId: 'page-1' });
      mocks.cmsPageBlockUpdate.mockResolvedValue({ pageId: 'page-1' });
      mocks.cmsPageFindUnique.mockResolvedValue(cmsPageSnapshotRow(now));

      await expect(
        cmsPageBlocksCatalogHandlers.updateFromForm('block-1', formData)
      ).resolves.toEqual({ ok: true });

      expect(mocks.cmsPageBlockUpdate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          imageAlt: 'Sailboats on the Charles',
          imageSrc: '/cms-media/asset-5/hero.png',
        }),
        select: { pageId: true },
        where: { id: 'block-1' },
      });
    });

    it('returns image alt field errors for partial block images', async () => {
      const formData = new FormData();
      formData.set('pageId', 'page-1');
      formData.set('kind', 'hero');
      formData.set('title', 'Hero');
      formData.set('imageSrc', '/cms-media/asset-5/hero.png');
      formData.set('imageAlt', '');
      formData.set('isVisible', 'true');

      await expect(
        cmsPageBlocksCatalogHandlers.updateFromForm('block-1', formData)
      ).resolves.toEqual({
        code: 'validation_failed',
        fieldErrors: {
          imageAlt: 'CMS image requires both source and alt text',
        },
        ok: false,
      });

      expect(mocks.cmsPageBlockUpdate).not.toHaveBeenCalled();
    });

    it('appends moved blocks to the target page', async () => {
      const now = new Date('2026-05-09T12:00:00.000Z');
      const formData = new FormData();
      formData.set('pageId', 'page-2');
      formData.set('kind', 'text_section');
      formData.set('title', 'Overview');
      formData.set('isVisible', 'true');

      mocks.cmsPageBlockFindUnique.mockResolvedValue({ pageId: 'page-1' });
      mocks.cmsPageBlockAggregate.mockResolvedValue({
        _max: { displayOrder: 6 },
      });
      mocks.cmsPageBlockUpdate.mockResolvedValue({ pageId: 'page-2' });
      mocks.cmsPageFindUnique.mockResolvedValue(cmsPageSnapshotRow(now));

      await expect(
        cmsPageBlocksCatalogHandlers.updateFromForm('block-1', formData)
      ).resolves.toEqual({ ok: true });

      expect(mocks.cmsPageBlockUpdate).toHaveBeenCalledWith({
        data: expect.objectContaining({ displayOrder: 7, pageId: 'page-2' }),
        select: { pageId: true },
        where: { id: 'block-1' },
      });
    });
  });

  describe('reorder', () => {
    it('rejects mixed page block ids', async () => {
      mocks.cmsPageBlockFindMany.mockResolvedValue([
        { id: 'block-1', pageId: 'page-1' },
        { id: 'block-2', pageId: 'page-2' },
      ]);

      await expect(
        cmsPageBlocksCatalogHandlers.reorder?.(['block-1', 'block-2'])
      ).resolves.toEqual({ ok: false, code: 'invalid_order' });

      expect(mocks.prismaTransaction).not.toHaveBeenCalled();
    });

    it('persists page-local block order', async () => {
      const now = new Date('2026-05-09T12:00:00.000Z');
      mocks.cmsPageBlockFindMany
        .mockResolvedValueOnce([
          { id: 'block-2', pageId: 'page-1' },
          { id: 'block-1', pageId: 'page-1' },
        ])
        .mockResolvedValueOnce([{ id: 'block-1' }, { id: 'block-2' }]);
      mocks.cmsPageFindUnique.mockResolvedValue(cmsPageSnapshotRow(now));

      await expect(
        cmsPageBlocksCatalogHandlers.reorder?.(['block-2', 'block-1'])
      ).resolves.toEqual({ ok: true });

      expect(mocks.cmsPageBlockUpdate).toHaveBeenNthCalledWith(1, {
        data: { displayOrder: 0 },
        where: { id: 'block-2' },
      });
      expect(mocks.cmsPageBlockUpdate).toHaveBeenNthCalledWith(2, {
        data: { displayOrder: 1 },
        where: { id: 'block-1' },
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

  describe('createFromForm', () => {
    it('appends new menu items after the current menu and parent order', async () => {
      const formData = new FormData();
      formData.set('menuId', 'menu-1');
      formData.set('parentId', 'parent-1');
      formData.set('label', 'Membership');
      formData.set('url', '/membership/');
      formData.set('isVisible', 'true');

      mocks.cmsMenuItemFindMany.mockResolvedValue([
        { id: 'parent-1', parentId: null },
        { id: 'item-1', parentId: 'parent-1' },
      ]);
      mocks.cmsMenuItemAggregate.mockResolvedValue({
        _max: { displayOrder: 4 },
      });
      mocks.cmsMenuItemCreate.mockResolvedValue({ id: 'item-2' });

      await expect(
        cmsMenuItemsCatalogHandlers.createFromForm(formData)
      ).resolves.toEqual({ ok: true, id: 'item-2' });

      expect(mocks.cmsMenuItemAggregate).toHaveBeenCalledWith({
        _max: { displayOrder: true },
        where: { menuId: 'menu-1', parentId: 'parent-1' },
      });
      expect(mocks.cmsMenuItemCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          displayOrder: 5,
          label: 'Membership',
          menuId: 'menu-1',
          parentId: 'parent-1',
        }),
        select: { id: true },
      });
    });
  });

  describe('updateFromForm', () => {
    it('preserves display order when editing menu item details', async () => {
      const formData = new FormData();
      formData.set('menuId', 'menu-1');
      formData.set('label', 'About MIT Sailing');
      formData.set('url', '/about/');
      formData.set('isVisible', 'true');

      mocks.cmsMenuItemFindMany.mockResolvedValue([
        { id: 'item-1', parentId: null },
      ]);
      mocks.cmsMenuItemUpdate.mockResolvedValue({ id: 'item-1' });

      await expect(
        cmsMenuItemsCatalogHandlers.updateFromForm('item-1', formData)
      ).resolves.toEqual({ ok: true });

      expect(mocks.cmsMenuItemAggregate).not.toHaveBeenCalled();
      expect(mocks.cmsMenuItemUpdate).toHaveBeenCalledWith({
        data: expect.not.objectContaining({ displayOrder: expect.any(Number) }),
        where: { id: 'item-1' },
      });
    });
  });

  describe('reorder', () => {
    it('persists menu-local row order', async () => {
      mocks.cmsMenuItemFindMany
        .mockResolvedValueOnce([
          { id: 'item-2', menuId: 'menu-1' },
          { id: 'item-1', menuId: 'menu-1' },
        ])
        .mockResolvedValueOnce([{ id: 'item-1' }, { id: 'item-2' }]);

      await expect(
        cmsMenuItemsCatalogHandlers.reorder?.(['item-2', 'item-1'])
      ).resolves.toEqual({ ok: true });

      expect(mocks.prismaTransaction).toHaveBeenCalledWith(
        expect.any(Function)
      );
      expect(mocks.cmsMenuItemUpdate).toHaveBeenNthCalledWith(1, {
        data: { displayOrder: 0 },
        where: { id: 'item-2' },
      });
      expect(mocks.cmsMenuItemUpdate).toHaveBeenNthCalledWith(2, {
        data: { displayOrder: 1 },
        where: { id: 'item-1' },
      });
    });

    it('rejects menu item ids from multiple menus', async () => {
      mocks.cmsMenuItemFindMany.mockResolvedValue([
        { id: 'item-1', menuId: 'menu-1' },
        { id: 'item-2', menuId: 'menu-2' },
      ]);

      await expect(
        cmsMenuItemsCatalogHandlers.reorder?.(['item-1', 'item-2'])
      ).resolves.toEqual({ ok: false, code: 'invalid_order' });

      expect(mocks.prismaTransaction).not.toHaveBeenCalled();
    });

    it('rejects missing menu item ids', async () => {
      mocks.cmsMenuItemFindMany
        .mockResolvedValueOnce([{ id: 'item-1', menuId: 'menu-1' }])
        .mockResolvedValueOnce([{ id: 'item-1' }, { id: 'item-2' }]);

      await expect(
        cmsMenuItemsCatalogHandlers.reorder?.(['item-1', 'missing-item'])
      ).resolves.toEqual({ ok: false, code: 'invalid_order' });

      expect(mocks.prismaTransaction).not.toHaveBeenCalled();
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
