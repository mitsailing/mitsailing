import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  getPublishedEventForPublicBySlug: vi.fn(),
  getTranslations: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  permanentRedirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  requireCurrentUser: vi.fn(),
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
  redirect: mocks.redirect,
}));

vi.mock('next/server', () => ({
  connection: mocks.connection,
}));

vi.mock('@/libs/Env', () => ({
  Env: {
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/components/mit-sailing/events/EventRegistrationForm', () => ({
  EventRegistrationForm: (): React.ReactNode => null,
  eventRegistrationFormLabels: vi.fn(() => ({})),
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
  requireCurrentUser: mocks.requireCurrentUser,
}));

vi.mock('@/libs/mit-sailing/easternTimeFormat', () => ({
  formatEasternEventRange: vi.fn(() => 'Jan 1, 2026'),
}));

vi.mock('@/libs/mit-sailing/eventQueries', () => ({
  getPublicEventRegistrationState: vi.fn(),
  getPublishedEventForPublicBySlug: mocks.getPublishedEventForPublicBySlug,
}));

vi.mock('@/libs/mit-sailing/eventRegistrationActions', () => ({
  createPublicEventRegistrationAction: vi.fn(),
}));

vi.mock('@/libs/mit-sailing/eventRegistrationErrors', () => ({
  eventRegistrationErrorMessage: vi.fn(() => null),
  parseEventRegistrationMutationCode: vi.fn(() => null),
}));

vi.mock('@/libs/mit-sailing/eventRegistrationState', () => ({
  publicEventReservationState: vi.fn(() => 'available'),
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
  mocks.getPublishedEventForPublicBySlug.mockResolvedValue(null);
  mocks.getTranslations.mockResolvedValue((key: string) => key);
  mocks.resolvePublicSlugRedirect.mockResolvedValue(null);
});

describe('EventRegisterPage', () => {
  it('redirects event history aliases before auth handling', async () => {
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
    expect(mocks.requireCurrentUser).not.toHaveBeenCalled();
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
    expect(mocks.requireCurrentUser).not.toHaveBeenCalled();
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
});
