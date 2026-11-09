import { describe, expect, it, vi } from 'vitest';

const redirect = vi.hoisted(() =>
  vi.fn((_path: string): never => {
    throw new Error('NEXT_REDIRECT');
  })
);

const requirePermission = vi.hoisted(() =>
  vi.fn( async () => Promise.resolve())
);
const setRequestLocale = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  redirect,
}));

vi.mock('next-intl/server', () => ({
  setRequestLocale,
}));

vi.mock('@/libs/auth/dal', () => ({
  requirePermission,
}));

describe('AdminCmsPageRevisionComparePage', () => {
  it('redirects to Payload page collection', async () => {
    const pageModule = await import('./page');
    const AdminCmsPageRevisionComparePage = pageModule.default;

    await expect(
      AdminCmsPageRevisionComparePage({
        params: Promise.resolve({ locale: 'en' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(requirePermission).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith('/cms/collections/pages');
  });
});
