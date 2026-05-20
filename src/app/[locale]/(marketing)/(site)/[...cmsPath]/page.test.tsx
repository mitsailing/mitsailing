import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadPublishedCmsPageByPath: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  permanentRedirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  resolvePublicSlugRedirect: vi.fn(),
  setRequestLocale: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  permanentRedirect: mocks.permanentRedirect,
}));

vi.mock('@/components/mit-sailing/admin/PublicAdminEditLink', () => ({
  PublicAdminEditLink: (): React.ReactNode => null,
}));

vi.mock('@/components/mit-sailing/cms/CmsPageBlocks', () => ({
  CmsPageBlocks: (): React.ReactNode => null,
}));

vi.mock('@/libs/admin/catalog/adminCatalogPaths', () => ({
  adminCatalogResourceEditPath: vi.fn(() => '/admin/catalog/cms_pages/page-1'),
}));

vi.mock('@/libs/mit-sailing/cmsQueries', () => ({
  loadPublishedCmsPageByPath: mocks.loadPublishedCmsPageByPath,
}));

vi.mock('@/libs/mit-sailing/publicSlugRedirects', () => ({
  resolvePublicSlugRedirect: mocks.resolvePublicSlugRedirect,
}));

function pageProps() {
  return {
    params: Promise.resolve({
      cmsPath: ['old', 'path'],
      locale: 'en',
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadPublishedCmsPageByPath.mockResolvedValue(null);
  mocks.resolvePublicSlugRedirect.mockResolvedValue(null);
});

describe('CmsCatchAllPage', () => {
  it('redirects cms history aliases after missing the current path', async () => {
    mocks.resolvePublicSlugRedirect.mockResolvedValue('/new/path');
    const pageModule = await import('./page');

    await expect(pageModule.default(pageProps())).rejects.toThrow(
      'NEXT_REDIRECT:/new/path'
    );

    expect(mocks.loadPublishedCmsPageByPath).toHaveBeenCalledWith('/old/path');
    expect(mocks.resolvePublicSlugRedirect).toHaveBeenCalledWith({
      locale: 'en',
      scope: 'cms',
      slug: '/old/path',
    });
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it('returns not found when cms history has no alias', async () => {
    const pageModule = await import('./page');

    await expect(pageModule.default(pageProps())).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );

    expect(mocks.resolvePublicSlugRedirect).toHaveBeenCalledWith({
      locale: 'en',
      scope: 'cms',
      slug: '/old/path',
    });
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
});
