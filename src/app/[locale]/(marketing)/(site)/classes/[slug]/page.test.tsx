import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getClassRelatedEventOccurrenceBlocks: vi.fn(),
  getSailingClassCatalogBySlug: vi.fn(),
  getTranslations: vi.fn(),
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
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  permanentRedirect: mocks.permanentRedirect,
}));

vi.mock('@/components/mit-sailing/classes/ClassDetailView', () => ({
  ClassDetailView: (): React.ReactNode => null,
}));

vi.mock('@/libs/mit-sailing/classQueries', () => ({
  getSailingClassCatalogBySlug: mocks.getSailingClassCatalogBySlug,
}));

vi.mock('@/libs/mit-sailing/classRelatedOccurrences', () => ({
  getClassRelatedEventOccurrenceBlocks:
    mocks.getClassRelatedEventOccurrenceBlocks,
}));

vi.mock('@/libs/mit-sailing/publicSlugRedirects', () => ({
  resolvePublicSlugRedirect: mocks.resolvePublicSlugRedirect,
}));

function pageProps() {
  return {
    params: Promise.resolve({ locale: 'en', slug: 'old-class' }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSailingClassCatalogBySlug.mockResolvedValue(null);
  mocks.getTranslations.mockResolvedValue((key: string) => key);
  mocks.resolvePublicSlugRedirect.mockResolvedValue(null);
});

describe('ClassDetailPage', () => {
  it('redirects class history aliases after missing the current slug', async () => {
    mocks.resolvePublicSlugRedirect.mockResolvedValue('/classes/new-class');
    const pageModule = await import('./page');

    await expect(pageModule.default(pageProps())).rejects.toThrow(
      'NEXT_REDIRECT:/classes/new-class'
    );

    expect(mocks.resolvePublicSlugRedirect).toHaveBeenCalledWith({
      locale: 'en',
      scope: 'classes',
      slug: 'old-class',
    });
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it('returns not found when class history has no alias', async () => {
    const pageModule = await import('./page');

    await expect(pageModule.default(pageProps())).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );

    expect(mocks.resolvePublicSlugRedirect).toHaveBeenCalledWith({
      locale: 'en',
      scope: 'classes',
      slug: 'old-class',
    });
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
});
