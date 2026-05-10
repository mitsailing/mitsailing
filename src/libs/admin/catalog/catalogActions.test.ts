import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogServerHandlers } from '@/libs/admin/catalog/types';

vi.mock('server-only', () => ({}));

const {
  createFromForm,
  getCatalogServerHandlers,
  redirect,
  requireAdmin,
  revalidatePath,
  revalidateTag,
  updateFromForm,
} = vi.hoisted(() => ({
  createFromForm: vi.fn(),
  getCatalogServerHandlers: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateFromForm: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath,
  revalidateTag,
}));

vi.mock('next/navigation', () => ({
  redirect,
}));

vi.mock('@/libs/admin/catalog/catalogServerRegistry', () => ({
  getCatalogServerHandlers,
}));

vi.mock('@/libs/auth/dal', () => ({
  requireAdmin,
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
  requireAdmin.mockReset();
  revalidatePath.mockClear();
  revalidateTag.mockClear();
  updateFromForm.mockReset();

  createFromForm.mockResolvedValue({ ok: true, id: 'row-1' });
  getCatalogServerHandlers.mockReturnValue(handlers);
  requireAdmin.mockImplementation(async () => {
    await Promise.resolve();
    return { user: { id: 'admin-1' } };
  });
  updateFromForm.mockResolvedValue({ ok: true });
});

describe('createCatalogResourceAction', () => {
  it('expires site alerts cache after creating site alerts', async () => {
    const { createCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');

    await expect(
      createCatalogResourceAction('en', 'site_alerts', new FormData())
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(revalidateTag).toHaveBeenCalledWith('site-alerts', { expire: 0 });
  });

  it('skips site alerts cache after creating other resources', async () => {
    const { createCatalogResourceAction } =
      await import('@/libs/admin/catalog/catalogActions');

    await expect(
      createCatalogResourceAction('en', 'donation_funds', new FormData())
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(revalidateTag).not.toHaveBeenCalled();
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
  });
});
