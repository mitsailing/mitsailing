import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getFleetBoatForPublicBySlug: vi.fn(),
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

vi.mock('@/components/mit-sailing/fleet/FleetBoatDetailView', () => ({
  FleetBoatDetailView: (): React.ReactNode => null,
}));

vi.mock('@/libs/mit-sailing/fleetQueries', () => ({
  getFleetBoatForPublicBySlug: mocks.getFleetBoatForPublicBySlug,
}));

vi.mock('@/libs/mit-sailing/publicSlugRedirects', () => ({
  resolvePublicSlugRedirect: mocks.resolvePublicSlugRedirect,
}));

function pageProps() {
  return {
    params: Promise.resolve({ locale: 'en', slug: 'old-boat' }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getFleetBoatForPublicBySlug.mockResolvedValue(null);
  mocks.getTranslations.mockResolvedValue((key: string) => key);
  mocks.resolvePublicSlugRedirect.mockResolvedValue(null);
});

describe('BoatDetailPage', () => {
  it('redirects fleet history aliases after missing the current slug', async () => {
    mocks.resolvePublicSlugRedirect.mockResolvedValue('/fleet/new-boat');
    const pageModule = await import('./page');

    await expect(pageModule.default(pageProps())).rejects.toThrow(
      'NEXT_REDIRECT:/fleet/new-boat'
    );

    expect(mocks.resolvePublicSlugRedirect).toHaveBeenCalledWith({
      locale: 'en',
      scope: 'fleet',
      slug: 'old-boat',
    });
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it('returns not found when fleet history has no alias', async () => {
    const pageModule = await import('./page');

    await expect(pageModule.default(pageProps())).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );

    expect(mocks.resolvePublicSlugRedirect).toHaveBeenCalledWith({
      locale: 'en',
      scope: 'fleet',
      slug: 'old-boat',
    });
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
});
