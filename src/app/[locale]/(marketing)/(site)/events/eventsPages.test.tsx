import { render } from '@testing-library/react';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LearnToSailManagedClassKind } from '@/generated/prisma/enums';

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  EventDetailView: vi.fn(() => <div data-testid="event-detail-view" />),
  EventsListView: vi.fn(() => <div data-testid="events-list-view" />),
  getCurrentUser: vi.fn(),
  getPublicEventRegistrationState: vi.fn(),
  getPublishedEventCalendarMonthBounds: vi.fn(),
  getPublishedEventForPublicBySlug: vi.fn(),
  getTranslations: vi.fn(),
  listPublishedEventDatesForCalendarMonth: vi.fn(),
  listVisibleEventCategoriesForPublicCalendarMonth: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  setRequestLocale: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/server', () => ({
  connection: mocks.connection,
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('@/components/mit-sailing/events/EventDetailView', () => ({
  EventDetailView: mocks.EventDetailView,
}));

vi.mock('@/components/mit-sailing/events/EventsListView', () => ({
  EventsListView: mocks.EventsListView,
}));

vi.mock('@/components/mit-sailing/SiteSectionMain', () => ({
  SiteSectionMain: (props: { children: React.ReactNode }) => (
    <main>{props.children}</main>
  ),
}));

vi.mock('@/components/mit-sailing/SiteSectionShell', () => ({
  SiteSectionShell: (props: { children: React.ReactNode }) => (
    <div data-testid="site-shell">{props.children}</div>
  ),
}));

vi.mock('@/libs/auth/dal', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/libs/mit-sailing/eventQueries', () => ({
  getPublicEventRegistrationState: mocks.getPublicEventRegistrationState,
  getPublishedEventCalendarMonthBounds:
    mocks.getPublishedEventCalendarMonthBounds,
  getPublishedEventForPublicBySlug: mocks.getPublishedEventForPublicBySlug,
  listPublishedEventDatesForCalendarMonth:
    mocks.listPublishedEventDatesForCalendarMonth,
  listVisibleEventCategoriesForPublicCalendarMonth:
    mocks.listVisibleEventCategoriesForPublicCalendarMonth,
}));

const eventCategory = {
  accentClassName: 'bg-mit-red',
  id: 'cat-lts',
  name: 'Learn to Sail',
};

const calendarEvent = {
  category: eventCategory,
  eventCategoryId: eventCategory.id,
  id: 'event-1',
  learnToSailManagedClassKind: LearnToSailManagedClassKind.none,
  name: 'Learn to Sail Class - Tech Dinghy for Beginners',
  shortName: 'Learn-to-Sail Class 1-2-3',
  slug: 'learn-to-sail-class-1-2-3',
};

const publicEvent = {
  id: 'event-1',
  name: 'Learn to Sail Class - All-in-One',
  slug: 'learn-to-sail-all-in-one',
};

function pageParams(slug = 'learn-to-sail-all-in-one') {
  return { locale: 'en', slug };
}

describe('EventsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTranslations.mockImplementation(async ({ namespace }) => {
      await Promise.resolve();
      return (key: string) => `${namespace}.${key}`;
    });
    mocks.getPublishedEventCalendarMonthBounds.mockResolvedValue({
      maxMonth: 6,
      maxYear: 2026,
      minMonth: 3,
      minYear: 2026,
    });
    mocks.listVisibleEventCategoriesForPublicCalendarMonth.mockResolvedValue([
      eventCategory,
    ]);
    mocks.listPublishedEventDatesForCalendarMonth.mockResolvedValue([
      {
        endDateTime: new Date('2026-04-07T23:30:00.000Z'),
        event: calendarEvent,
        id: 'date-1',
        startDateTime: new Date('2026-04-07T21:30:00.000Z'),
      },
    ]);
  });

  it('uses the first repeated search value and keeps valid category filters', async () => {
    const { default: EventsListPage } = await import('./page');

    render(
      await EventsListPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({
          category: ['cat-lts', 'ignored'],
          month: ['2026-04', '2026-05'],
        }),
      })
    );

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.listPublishedEventDatesForCalendarMonth).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat-lts' })
    );
    expect(mocks.EventsListView).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'en',
        occurrenceRows: expect.arrayContaining([
          expect.objectContaining({ event: calendarEvent }),
        ]),
        selectedCategoryId: 'cat-lts',
        visibleMonth: { month: 4, year: 2026 },
      }),
      undefined
    );
  });

  it('drops unknown category filters before querying calendar dates', async () => {
    const { default: EventsListPage } = await import('./page');

    render(
      await EventsListPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({
          category: 'cat-missing',
          month: '2026-04',
        }),
      })
    );

    expect(mocks.listPublishedEventDatesForCalendarMonth).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: undefined })
    );
  });

  it('builds translated list metadata', async () => {
    const { generateMetadata } = await import('./page');

    await expect(
      generateMetadata({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    ).resolves.toEqual({ title: 'MitSailingEvents.meta_title_list' });
  });
});

describe('EventDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTranslations.mockImplementation(async ({ namespace }) => {
      await Promise.resolve();
      return (key: string) => `${namespace}.${key}`;
    });
  });

  it('passes the signed-in registration state to the detail view', async () => {
    mocks.getPublishedEventForPublicBySlug.mockResolvedValue(publicEvent);
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' });
    mocks.getPublicEventRegistrationState.mockResolvedValue({
      status: 'approved',
    });
    const { default: EventDetailPage } = await import('./[slug]/page');

    render(
      await EventDetailPage({
        params: Promise.resolve(pageParams()),
        searchParams: Promise.resolve({ registration: 'already_registered' }),
      })
    );

    expect(mocks.getPublicEventRegistrationState).toHaveBeenCalledWith({
      eventId: 'event-1',
      userId: 'user-1',
    });
    expect(mocks.EventDetailView).toHaveBeenCalledWith(
      expect.objectContaining({
        currentRegistration: { status: 'approved' },
        errorCode: 'already_registered',
        event: publicEvent,
        isSignedIn: true,
      }),
      undefined
    );
  });

  it('renders anonymous detail pages without querying registration state', async () => {
    mocks.getPublishedEventForPublicBySlug.mockResolvedValue(publicEvent);
    mocks.getCurrentUser.mockResolvedValue(null);
    const { default: EventDetailPage } = await import('./[slug]/page');

    render(await EventDetailPage({ params: Promise.resolve(pageParams()) }));

    expect(mocks.getPublicEventRegistrationState).not.toHaveBeenCalled();
    expect(mocks.EventDetailView).toHaveBeenCalledWith(
      expect.objectContaining({
        currentRegistration: null,
        isSignedIn: false,
      }),
      undefined
    );
  });

  it('returns event and fallback metadata', async () => {
    const { generateMetadata } = await import('./[slug]/page');
    mocks.getPublishedEventForPublicBySlug.mockResolvedValueOnce(publicEvent);

    await expect(
      generateMetadata({ params: Promise.resolve(pageParams()) })
    ).resolves.toEqual({
      title: 'Learn to Sail Class - All-in-One',
    });

    mocks.getPublishedEventForPublicBySlug.mockResolvedValueOnce(null);
    await expect(
      generateMetadata({ params: Promise.resolve(pageParams('missing')) })
    ).resolves.toEqual({ title: 'MitSailingEvents.meta_title_not_found' });
  });

  it('returns not found for missing public events', async () => {
    mocks.getPublishedEventForPublicBySlug.mockResolvedValue(null);
    const { default: EventDetailPage } = await import('./[slug]/page');

    await expect(
      EventDetailPage({ params: Promise.resolve(pageParams('missing')) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
