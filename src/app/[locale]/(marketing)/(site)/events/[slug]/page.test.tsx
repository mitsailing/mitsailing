import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  getCurrentUser: vi.fn(),
  getPublishedEventForPublicBySlug: vi.fn(),
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

vi.mock('next/server', () => ({
  connection: mocks.connection,
}));

vi.mock('@/components/mit-sailing/events/EventDetailView', () => ({
  EventDetailView: (): React.ReactNode => null,
}));

vi.mock('@/components/mit-sailing/SiteSectionMain', () => ({
  SiteSectionMain: (props: { children: React.ReactNode }): React.ReactNode =>
    props.children,
}));

vi.mock('@/components/mit-sailing/SiteSectionShell', () => ({
  SiteSectionShell: (props: { children: React.ReactNode }): React.ReactNode =>
    props.children,
}));

vi.mock('@/libs/auth/dal', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/libs/mit-sailing/eventQueries', () => ({
  getPublicEventRegistrationState: vi.fn(),
  getPublishedEventForPublicBySlug: mocks.getPublishedEventForPublicBySlug,
}));

vi.mock('@/libs/mit-sailing/publicSlugRedirects', () => ({
  resolvePublicSlugRedirect: mocks.resolvePublicSlugRedirect,
}));

function pageProps() {
  return {
    params: Promise.resolve({ locale: 'en', slug: 'old-event' }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue(null);
  mocks.getPublishedEventForPublicBySlug.mockResolvedValue(null);
  mocks.getTranslations.mockResolvedValue((key: string) => key);
  mocks.resolvePublicSlugRedirect.mockResolvedValue(null);
});

describe('EventDetailPage', () => {
  it('redirects event history aliases after missing the current slug', async () => {
    mocks.resolvePublicSlugRedirect.mockResolvedValue('/events/new-event');
    const pageModule = await import('./page');

    await expect(pageModule.default(pageProps())).rejects.toThrow(
      'NEXT_REDIRECT:/events/new-event'
    );

    expect(mocks.resolvePublicSlugRedirect).toHaveBeenCalledWith({
      locale: 'en',
      scope: 'events',
      slug: 'old-event',
    });
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it('returns not found when event history has no alias', async () => {
    const pageModule = await import('./page');

    await expect(pageModule.default(pageProps())).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );

    expect(mocks.resolvePublicSlugRedirect).toHaveBeenCalledWith({
      locale: 'en',
      scope: 'events',
      slug: 'old-event',
    });
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
});
