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
  redirect: vi.fn(() => {
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
});
