import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogServerHandlers } from '@/libs/admin/catalog/types';
import { Permission } from '@/libs/auth/permissions';

vi.mock('server-only', () => ({}));

const {
  createFromForm,
  getCatalogServerHandlers,
  redirect,
  requirePermission,
  revalidatePath,
  restoreCatalogRevision,
  restoreCmsPageRevision,
  updateFromForm,
  updateTag,
} = vi.hoisted(() => ({
  createFromForm: vi.fn(),
  getCatalogServerHandlers: vi.fn(),
  redirect: vi.fn((_path: string): never => {
    throw new Error('NEXT_REDIRECT');
  }),
  requirePermission: vi.fn(),
  revalidatePath: vi.fn(),
  restoreCatalogRevision: vi.fn(),
  restoreCmsPageRevision: vi.fn(),
  updateFromForm: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath,
  updateTag,
}));

vi.mock('next/navigation', () => ({
  redirect,
}));

vi.mock('@/libs/admin/catalog/catalogServerRegistry', () => ({
  getCatalogServerHandlers,
}));

vi.mock('@/libs/auth/dal', () => ({
  requirePermission,
}));

vi.mock('@/libs/mit-sailing/catalogHistory', () => ({
  isCatalogHistoryResourceId: (resourceId: string) =>
    resourceId === 'fleet' || resourceId === 'sailing_classes',
  restoreCatalogRevision,
}));

vi.mock('@/libs/mit-sailing/cmsHistory', () => ({
  restoreCmsPageRevision,
}));

vi.mock('@/libs/mit-sailing/siteAlertQueries', () => ({
  SITE_ALERTS_CACHE_TAG: 'site-alerts',
}));

const handlers: CatalogServerHandlers = {
  list: async () => {
    await Promise.resolve();
    return [];
  },
  getById: async () => {
    await Promise.resolve();
    return null;
  },
  createFromForm,
  updateFromForm,
  delete: async () => {
    await Promise.resolve();
    return { ok: true };
  },
};

beforeEach(() => {
  createFromForm.mockReset();
  getCatalogServerHandlers.mockReset();
  redirect.mockClear();
  requirePermission.mockReset();
  revalidatePath.mockClear();
  updateTag.mockClear();
  restoreCatalogRevision.mockReset();
  restoreCmsPageRevision.mockReset();
  updateFromForm.mockReset();

  createFromForm.mockResolvedValue({ ok: true, id: 'row-1' });
  getCatalogServerHandlers.mockReturnValue(handlers);
  requirePermission.mockImplementation(async () => {
    await Promise.resolve();
    return { session: { impersonatedBy: null }, user: { id: 'staff-1' } };
  });
  restoreCatalogRevision.mockResolvedValue({ ok: true, slug: 'boat-1' });
  restoreCmsPageRevision.mockResolvedValue({ ok: true });
  updateFromForm.mockResolvedValue({ ok: true });
});

describe('createCatalogResourceAction', () => {
  it('requires the create permission for the resource', async () => {
    const { createCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');

    await expect(
      createCatalogResourceAction('en', 'sailing_classes', new FormData())
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(requirePermission).toHaveBeenCalledWith(
      Permission.SAILING_CLASSES_MANAGE,
      'en'
    );
  });

  it('expires site alerts cache after creating site alerts', async () => {
    const { createCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');

    await expect(
      createCatalogResourceAction('en', 'site_alerts', new FormData())
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(updateTag).toHaveBeenCalledWith('site-alerts');
  });

  it('skips site alerts cache after creating other resources', async () => {
    const { createCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');

    await expect(
      createCatalogResourceAction('en', 'donation_funds', new FormData())
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(updateTag).not.toHaveBeenCalled();
  });

  it('invalidates sitemap catalog cache after creating sailing_classes', async () => {
    const { createCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');

    await expect(
      createCatalogResourceAction('en', 'sailing_classes', new FormData())
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(updateTag).toHaveBeenCalledWith('sitemap-catalog');
  });

  it('invalidates class nav cache after creating class_categories', async () => {
    const { createCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');

    await expect(
      createCatalogResourceAction('en', 'class_categories', new FormData())
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(updateTag).toHaveBeenCalledWith('site-nav-classes');
  });

  it('opens the edit screen after creating a CMS page block', async () => {
    const { createCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');
    const formData = new FormData();
    formData.set('pageId', 'page-2');

    await expect(
      createCatalogResourceAction('en', 'cms_page_blocks', formData)
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirect).toHaveBeenCalledWith(
      '/admin/cms_page_blocks/row-1/edit?page=page-2'
    );
  });

  it('preserves menu scope on CMS menu item validation errors', async () => {
    const { createCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');
    const formData = new FormData();
    formData.set('menuId', 'menu-2');
    createFromForm.mockResolvedValue({ code: 'validation_failed', ok: false });

    await expect(
      createCatalogResourceAction('en', 'cms_menu_items', formData)
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirect).toHaveBeenCalledWith(
      '/admin/cms_menu_items/new?menu=menu-2&error=validation_failed'
    );
  });
});

describe('updateCatalogResourceAction', () => {
  it('stays on the edit screen after updating a catalog row', async () => {
    const { updateCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');

    await expect(
      updateCatalogResourceAction('en', 'fleet', 'boat-1', new FormData())
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirect).toHaveBeenCalledWith('/admin/fleet/boat-1/edit');
    expect(updateTag).toHaveBeenCalledWith('sitemap-catalog');
    expect(updateTag).toHaveBeenCalledWith('site-nav-fleet');
  });

  it('preserves page scope after updating a CMS page block', async () => {
    const { updateCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');
    const formData = new FormData();
    formData.set('pageId', 'page-2');

    await expect(
      updateCatalogResourceAction('en', 'cms_page_blocks', 'block-1', formData)
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirect).toHaveBeenCalledWith(
      '/admin/cms_page_blocks/block-1/edit?page=page-2'
    );
    expect(requirePermission).toHaveBeenCalledWith(Permission.CMS_EDIT, 'en');
  });

  it('redirects update failures with bounded field errors', async () => {
    const { updateCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');
    const longMessage = 'x'.repeat(520);
    updateFromForm.mockResolvedValue({
      code: 'validation_failed',
      fieldErrors: { name: longMessage },
      ok: false,
    });

    await expect(
      updateCatalogResourceAction('en', 'fleet', 'boat-1', new FormData())
    ).rejects.toThrow('NEXT_REDIRECT');

    const path = redirect.mock.calls[0]?.[0];
    expect(path).toContain('/admin/fleet/boat-1/edit?error=validation_failed');
    expect(path).toContain(encodeURIComponent('x'.repeat(500)));
    expect(path).not.toContain(encodeURIComponent('x'.repeat(501)));
  });
});

describe('deleteCatalogResourceAction', () => {
  it('redirects delete failures back to the confirmation screen', async () => {
    const deleteHandler = vi.fn(async () => {
      await Promise.resolve();
      return { ok: false, code: 'foreign_key' } as const;
    });
    getCatalogServerHandlers.mockReturnValue({
      ...handlers,
      delete: deleteHandler,
    });
    const { deleteCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');

    await expect(
      deleteCatalogResourceAction('en', 'event_categories', 'cat-1')
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(requirePermission).toHaveBeenCalledWith(
      Permission.EVENT_CATEGORIES_MANAGE,
      'en'
    );
    expect(redirect).toHaveBeenCalledWith(
      '/admin/event_categories/cat-1/delete?error=foreign_key'
    );
  });
});

describe('restoreCmsPageRevisionAction', () => {
  it('requires confirmation before restoring CMS page revisions', async () => {
    const { restoreCmsPageRevisionAction } =
      await import('@/libs/admin/catalog/catalogActions');

    await expect(
      restoreCmsPageRevisionAction('en', 'page-1', 'rev-1', new FormData())
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(requirePermission).toHaveBeenCalledWith(Permission.CMS_EDIT, 'en');
    expect(restoreCmsPageRevision).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(
      '/admin/cms_pages/page-1/edit?error=validation_failed'
    );
  });

  it('redirects CMS restore failures to the edit screen', async () => {
    const { restoreCmsPageRevisionAction } =
      await import('@/libs/admin/catalog/catalogActions');
    const formData = new FormData();
    formData.set('confirmRestore', 'true');
    restoreCmsPageRevision.mockResolvedValue({
      code: 'revision_not_found',
      ok: false,
    });

    await expect(
      restoreCmsPageRevisionAction('en', 'page-1', 'rev-1', formData)
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirect).toHaveBeenCalledWith(
      '/admin/cms_pages/page-1/edit?error=revision_not_found'
    );
  });
});

describe('restoreCatalogResourceRevisionAction', () => {
  it('redirects unsupported catalog resources without restoring', async () => {
    const { restoreCatalogResourceRevisionAction } =
      await import('@/libs/admin/catalog/catalogActions');
    const formData = new FormData();
    formData.set('confirmRestore', 'true');

    await expect(
      restoreCatalogResourceRevisionAction(
        'en',
        'event_categories',
        'cat-1',
        'rev-1',
        formData
      )
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(requirePermission).toHaveBeenCalledWith(
      Permission.EVENT_CATEGORIES_MANAGE,
      'en'
    );
    expect(restoreCatalogRevision).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith('/admin/event_categories/cat-1/edit');
  });

  it('requires confirmation before restoring catalog revisions', async () => {
    const { restoreCatalogResourceRevisionAction } =
      await import('@/libs/admin/catalog/catalogActions');

    await expect(
      restoreCatalogResourceRevisionAction(
        'en',
        'fleet',
        'boat-1',
        'rev-1',
        new FormData()
      )
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(restoreCatalogRevision).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(
      '/admin/fleet/boat-1/edit?error=validation_failed'
    );
  });

  it('revalidates old and restored detail pages after restoring catalog rows', async () => {
    const { restoreCatalogResourceRevisionAction } =
      await import('@/libs/admin/catalog/catalogActions');
    const formData = new FormData();
    formData.set('confirmRestore', 'true');
    getCatalogServerHandlers.mockReturnValue({
      ...handlers,
      getById: async () => {
        await Promise.resolve();
        return { id: 'boat-1', slug: 'old-boat' };
      },
    });
    restoreCatalogRevision.mockResolvedValue({ ok: true, slug: 'new-boat' });

    await expect(
      restoreCatalogResourceRevisionAction(
        'en',
        'fleet',
        'boat-1',
        'rev-1',
        formData
      )
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(restoreCatalogRevision).toHaveBeenCalledWith({
      context: expect.objectContaining({ userId: 'staff-1' }),
      itemId: 'boat-1',
      resourceId: 'fleet',
      revisionId: 'rev-1',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/fleet/old-boat');
    expect(revalidatePath).toHaveBeenCalledWith('/fleet/new-boat');
    expect(redirect).toHaveBeenCalledWith('/admin/fleet/boat-1/edit');
  });
});

describe('reorderCatalogResourceAction', () => {
  it('rejects unknown resources before requiring permission', async () => {
    const { reorderCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');

    await expect(
      reorderCatalogResourceAction('en', 'unknown_resource', ['row-1'])
    ).resolves.toEqual({ ok: false, code: 'unknown_resource' });

    expect(requirePermission).not.toHaveBeenCalled();
  });

  it('rejects resources without reorder handlers', async () => {
    const { reorderCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');

    await expect(
      reorderCatalogResourceAction('en', 'event_categories', ['cat-1'])
    ).resolves.toEqual({ ok: false, code: 'reorder_disabled' });

    expect(requirePermission).toHaveBeenCalledWith(
      Permission.EVENT_CATEGORIES_MANAGE,
      'en'
    );
  });

  it('rejects invalid reorder payloads before calling handlers', async () => {
    const reorder = vi.fn();
    getCatalogServerHandlers.mockReturnValue({ ...handlers, reorder });
    const { reorderCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');

    await expect(
      reorderCatalogResourceAction('en', 'event_categories', [])
    ).resolves.toEqual({ ok: false, code: 'invalid_payload' });

    expect(reorder).not.toHaveBeenCalled();
  });

  it('requires sailing class reorder scope', async () => {
    const reorder = vi.fn();
    getCatalogServerHandlers.mockReturnValue({ ...handlers, reorder });
    const { reorderCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');

    await expect(
      reorderCatalogResourceAction('en', 'sailing_classes', ['class-1'])
    ).resolves.toEqual({ ok: false, code: 'invalid_payload' });

    expect(reorder).not.toHaveBeenCalled();
  });

  it('rejects unexpected reorder scope for unscoped resources', async () => {
    const reorder = vi.fn();
    getCatalogServerHandlers.mockReturnValue({ ...handlers, reorder });
    const { reorderCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');

    await expect(
      reorderCatalogResourceAction('en', 'event_categories', ['cat-1'], {
        classCategoryId: 'category-1',
      })
    ).resolves.toEqual({ ok: false, code: 'invalid_payload' });

    expect(reorder).not.toHaveBeenCalled();
  });

  it('passes sailing class scope and mutation context to reorder handlers', async () => {
    const reorder = vi.fn(async () => {
      await Promise.resolve();
      return { ok: true } as const;
    });
    getCatalogServerHandlers.mockReturnValue({ ...handlers, reorder });
    const { reorderCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');

    await expect(
      reorderCatalogResourceAction('en', 'sailing_classes', ['class-1'], {
        classCategoryId: 'category-1',
      })
    ).resolves.toEqual({ ok: true });

    expect(requirePermission).toHaveBeenCalledWith(
      Permission.SAILING_CLASSES_MANAGE,
      'en'
    );
    expect(reorder).toHaveBeenCalledWith(
      ['class-1'],
      { classCategoryId: 'category-1' },
      expect.objectContaining({ userId: 'staff-1' })
    );
    expect(revalidatePath).toHaveBeenCalledWith('/classes');
  });

  it('returns reorder handler failures without revalidating', async () => {
    const reorder = vi.fn(async () => {
      await Promise.resolve();
      return { ok: false, code: 'invalid_order' } as const;
    });
    getCatalogServerHandlers.mockReturnValue({ ...handlers, reorder });
    const { reorderCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');

    await expect(
      reorderCatalogResourceAction('en', 'event_categories', ['cat-1'])
    ).resolves.toEqual({ ok: false, code: 'invalid_order' });

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
