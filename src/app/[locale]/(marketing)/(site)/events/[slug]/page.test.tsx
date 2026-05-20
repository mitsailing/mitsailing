import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  getCurrentUser: vi.fn(),
  getPublicEventRegistrationState: vi.fn(),
  getPublishedEventForPublicBySlug: vi.fn(),
  getTranslations: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  permanentRedirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  redirectPublicSlugAliasOrNotFound: vi.fn(),
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
  getPublicEventRegistrationState: mocks.getPublicEventRegistrationState,
  getPublishedEventForPublicBySlug: mocks.getPublishedEventForPublicBySlug,
}));

vi.mock('@/libs/mit-sailing/publicSlugRedirects', () => ({
  redirectPublicSlugAliasOrNotFound: mocks.redirectPublicSlugAliasOrNotFound,
}));

function pageProps() {
  return {
    params: Promise.resolve({ locale: 'en', slug: 'old-event' }),
  };
}

function deferred<T>() {
  return Promise.withResolvers<T>();
}

async function flushPageStartup(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue(null);
  mocks.getPublicEventRegistrationState.mockResolvedValue(null);
  mocks.getPublishedEventForPublicBySlug.mockResolvedValue(null);
  mocks.getTranslations.mockResolvedValue((key: string) => key);
  mocks.redirectPublicSlugAliasOrNotFound.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
});

describe('EventDetailPage', () => {
  it('redirects event history aliases after missing the current slug', async () => {
    mocks.redirectPublicSlugAliasOrNotFound.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT:/events/new-event');
    });
    const pageModule = await import('./page');

    await expect(pageModule.default(pageProps())).rejects.toThrow(
      'NEXT_REDIRECT:/events/new-event'
    );

    expect(mocks.redirectPublicSlugAliasOrNotFound).toHaveBeenCalledWith({
      locale: 'en',
      scope: 'events',
      slug: 'old-event',
    });
  });

  it('returns not found when event history has no alias', async () => {
    const pageModule = await import('./page');

    await expect(pageModule.default(pageProps())).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );

    expect(mocks.redirectPublicSlugAliasOrNotFound).toHaveBeenCalledWith({
      locale: 'en',
      scope: 'events',
      slug: 'old-event',
    });
  });

  it('loads signed in registration state in parallel with the event', async () => {
    const event = {
      id: 'event-1',
      name: 'Spring Regatta',
    };
    const eventResult = deferred<typeof event>();
    mocks.getPublishedEventForPublicBySlug.mockReturnValue(eventResult.promise);
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' });
    const pageModule = await import('./page');

    const pagePromise = pageModule.default(pageProps());
    await flushPageStartup();

    expect(mocks.getCurrentUser).toHaveBeenCalled();

    eventResult.resolve(event);
    await pagePromise;

    expect(mocks.getPublicEventRegistrationState).toHaveBeenCalledWith({
      eventId: 'event-1',
      userId: 'user-1',
    });
  });
});
