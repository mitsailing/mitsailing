import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogServerHandlers } from '@/libs/admin/catalog/types';

const {
  createFromForm,
  getCatalogServerHandlers,
  redirect,
  requireAdmin,
  revalidatePath,
  revalidateTag,
} = vi.hoisted(() => ({
  createFromForm: vi.fn(),
  getCatalogServerHandlers: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
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
  updateFromForm: async () => {
    await Promise.resolve();
    return { ok: true };
  },
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

  createFromForm.mockResolvedValue({ ok: true, id: 'row-1' });
  getCatalogServerHandlers.mockReturnValue(handlers);
  requireAdmin.mockImplementation(async () => {
    await Promise.resolve();
  });
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
});
