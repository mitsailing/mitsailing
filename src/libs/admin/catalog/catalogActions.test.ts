import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  updateCatalogResourceAction,
  updateCatalogVisibilityAction,
} from '@/libs/admin/catalog/catalogActions';
import type { CatalogServerHandlers } from '@/libs/admin/catalog/types';

const mocks = vi.hoisted(() => ({
  getCatalogServerHandlers: vi.fn(),
  logCatalogChange: vi.fn(),
  redirect: vi.fn(),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
  updateTag: mocks.updateTag,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/app/sitemap', () => ({
  sitemapCatalogCacheTag: 'sitemap-catalog',
}));

vi.mock('@/libs/auth/dal', () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock('@/libs/admin/catalog/catalogEditMetadata', () => ({
  getCatalogChangeVersion: vi.fn(),
  logCatalogChange: mocks.logCatalogChange,
}));

vi.mock('@/libs/admin/catalog/catalogServerRegistry', () => ({
  getCatalogServerHandlers: mocks.getCatalogServerHandlers,
}));

describe('catalogActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('applies repeated visibility updates from the current row snapshot', async () => {
    const row = {
      name: 'Rhodes 19',
      slug: 'rhodes-19',
      type: 'Keelboat',
      capacity: 5,
      requiredClassId: 'intro-to-sailing',
      description: '<p>Current.</p>',
      isVisible: true,
      fleetVisibleBoats: 'helper payload',
    };
    const getById = vi.fn<CatalogServerHandlers['getById']>();
    getById.mockResolvedValue(row);
    const updateFromForm = vi.fn<CatalogServerHandlers['updateFromForm']>();
    updateFromForm.mockResolvedValue({ ok: true });
    const handlers = {
      getById,
      updateFromForm,
    } as Pick<CatalogServerHandlers, 'getById' | 'updateFromForm'>;
    mocks.getCatalogServerHandlers.mockReturnValue(handlers);
    const formData = new FormData();
    formData.set('isVisible', 'true');

    const firstResult = await updateCatalogVisibilityAction(
      'en',
      'fleet',
      'boat-1',
      formData
    );
    const secondResult = await updateCatalogVisibilityAction(
      'en',
      'fleet',
      'boat-1',
      formData
    );

    expect(firstResult).toEqual({ ok: true, isVisible: true, changed: false });
    expect(secondResult).toEqual({ ok: true, isVisible: true, changed: false });
    expect(getById).toHaveBeenCalledTimes(2);
    expect(updateFromForm).not.toHaveBeenCalled();
    expect(mocks.logCatalogChange).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it('skips unchanged catalog resource saves', async () => {
    const row = {
      fundId: '2720840',
      name: 'Sailing fund',
      description: 'Support sailing.',
      url: 'https://giving.mit.edu/form',
      isVisible: true,
    };
    const getById = vi.fn<CatalogServerHandlers['getById']>();
    getById.mockResolvedValue(row);
    const updateFromForm = vi.fn<CatalogServerHandlers['updateFromForm']>();
    updateFromForm.mockResolvedValue({ ok: true });
    const handlers = {
      getById,
      updateFromForm,
    } as Pick<CatalogServerHandlers, 'getById' | 'updateFromForm'>;
    mocks.getCatalogServerHandlers.mockReturnValue(handlers);
    const formData = new FormData();
    formData.set('fundId', row.fundId);
    formData.set('name', row.name);
    formData.set('description', row.description);
    formData.set('url', row.url);
    formData.append('isVisible', 'false');
    formData.append('isVisible', 'true');

    const result = await updateCatalogResourceAction(
      'en',
      'donation_funds',
      'fund-1',
      formData
    );

    expect(result).toEqual({ ok: true, changed: false });
    expect(getById).toHaveBeenCalledTimes(1);
    expect(updateFromForm).not.toHaveBeenCalled();
    expect(mocks.logCatalogChange).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });
});
