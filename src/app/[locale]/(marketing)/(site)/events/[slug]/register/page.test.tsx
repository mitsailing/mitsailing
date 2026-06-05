import { render, screen } from '@testing-library/react';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LearnToSailWaitlistEntryStatus } from '@/generated/prisma/enums';

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  createPublicEventRegistrationAction: vi.fn(async () => {}),
  EventRegistrationForm: vi.fn(() => (
    <div data-testid="event-registration-form" />
  )),
  eventRegistrationErrorMessage: vi.fn(),
  eventUsesLearnToSailWaitlist: vi.fn(),
  formatEasternEventRange: vi.fn(),
  getI18nPath: vi.fn((path: string) => path),
  getLearnToSailSeasonYear: vi.fn(),
  getPublicEventRegistrationState: vi.fn(),
  getPublishedEventForPublicBySlug: vi.fn(),
  getTranslations: vi.fn(),
  isLearnToSailWaitlistOpen: vi.fn(),
  joinLearnToSailWaitlistAction: vi.fn(async () => {}),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  parseEventRegistrationMutationCode: vi.fn(),
  publicEventReservationState: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  requireCurrentUser: vi.fn(),
  setRequestLocale: vi.fn(),
  userFindUnique: vi.fn(),
  waitlistFindFirst: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/server', () => ({
  connection: mocks.connection,
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('@/components/mit-sailing/events/EventRegistrationForm', () => ({
  EventRegistrationForm: mocks.EventRegistrationForm,
  eventRegistrationFormLabels: () => ({ submit: 'Submit registration' }),
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

vi.mock('@/components/ui/submit-button', () => ({
  SubmitButton: (props: {
    children: React.ReactNode;
    className?: string;
    pendingLabel: string;
    type: 'button' | 'submit';
    variant: string;
  }) => (
    <button type={props.type === 'submit' ? 'submit' : 'button'}>
      {props.children}
    </button>
  ),
}));

vi.mock('@/libs/auth/dal', () => ({
  requireCurrentUser: mocks.requireCurrentUser,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    learnToSailWaitlistEntry: {
      findFirst: mocks.waitlistFindFirst,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
  },
}));

vi.mock('@/libs/mit-sailing/easternTimeFormat', () => ({
  formatEasternEventRange: mocks.formatEasternEventRange,
}));

vi.mock('@/libs/mit-sailing/eventQueries', () => ({
  getPublicEventRegistrationState: mocks.getPublicEventRegistrationState,
  getPublishedEventForPublicBySlug: mocks.getPublishedEventForPublicBySlug,
}));

vi.mock('@/libs/mit-sailing/eventRegistrationActions', () => ({
  createPublicEventRegistrationAction:
    mocks.createPublicEventRegistrationAction,
}));

vi.mock('@/libs/mit-sailing/eventRegistrationErrors', () => ({
  eventRegistrationErrorMessage: mocks.eventRegistrationErrorMessage,
  parseEventRegistrationMutationCode: mocks.parseEventRegistrationMutationCode,
}));

vi.mock('@/libs/mit-sailing/eventRegistrationState', () => ({
  publicEventReservationState: mocks.publicEventReservationState,
}));

vi.mock('@/libs/mit-sailing/learnToSailEvents', () => ({
  eventUsesLearnToSailWaitlist: mocks.eventUsesLearnToSailWaitlist,
}));

vi.mock('@/libs/mit-sailing/learnToSailWaitlist', () => ({
  getLearnToSailSeasonYear: mocks.getLearnToSailSeasonYear,
  isLearnToSailWaitlistOpen: mocks.isLearnToSailWaitlistOpen,
}));

vi.mock('@/libs/mit-sailing/learnToSailWaitlistActions', () => ({
  joinLearnToSailWaitlistAction: mocks.joinLearnToSailWaitlistAction,
}));

vi.mock('@/utils/Helpers', () => ({
  getI18nPath: mocks.getI18nPath,
}));

const event = {
  dates: [
    {
      endDateTime: new Date('2026-04-07T23:30:00.000Z'),
      id: 'date-1',
      startDateTime: new Date('2026-04-07T21:30:00.000Z'),
    },
  ],
  id: 'event-1',
  name: 'Learn to Sail Class - Tech Dinghy for Beginners',
  slug: 'learn-to-sail-class-1-2-3',
};

function params(slug = event.slug) {
  return { locale: 'en', slug };
}

function t(key: string, values?: { event?: string }) {
  if (key === 'checkout_title' && values?.event) {
    return `Checkout for ${values.event}`;
  }
  return `MitSailingEvents.${key}`;
}

describe('EventRegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.formatEasternEventRange.mockReturnValue('Tue, Apr 7, 5:30-7:30 PM');
    mocks.getLearnToSailSeasonYear.mockReturnValue(2026);
    mocks.getPublishedEventForPublicBySlug.mockResolvedValue(event);
    mocks.getPublicEventRegistrationState.mockResolvedValue(null);
    mocks.getTranslations.mockResolvedValue(t);
    mocks.isLearnToSailWaitlistOpen.mockReturnValue(true);
    mocks.parseEventRegistrationMutationCode.mockReturnValue(null);
    mocks.publicEventReservationState.mockReturnValue('available');
    mocks.requireCurrentUser.mockResolvedValue({ id: 'user-1' });
    mocks.userFindUnique.mockResolvedValue({ phone: '617-555-0000' });
    mocks.waitlistFindFirst.mockResolvedValue(null);
  });

  it('uses waitlist language in metadata for managed Learn-to-Sail events', async () => {
    mocks.eventUsesLearnToSailWaitlist.mockReturnValue(true);
    const { generateMetadata } = await import('./page');

    await expect(
      generateMetadata({ params: Promise.resolve(params()) })
    ).resolves.toEqual({
      title:
        'MitSailingEvents.registration_request_class_eyebrow - Learn to Sail Class - Tech Dinghy for Beginners',
    });
  });

  it('uses fallback metadata when the event is missing', async () => {
    mocks.getPublishedEventForPublicBySlug.mockResolvedValue(null);
    const { generateMetadata } = await import('./page');

    await expect(
      generateMetadata({ params: Promise.resolve(params('missing')) })
    ).resolves.toEqual({
      title: 'MitSailingEvents.meta_title_not_found',
    });
  });

  it('redirects unavailable registration requests back to the event detail page', async () => {
    mocks.eventUsesLearnToSailWaitlist.mockReturnValue(false);
    mocks.publicEventReservationState.mockReturnValue('closed');
    const { default: EventRegisterPage } = await import('./page');

    await expect(
      EventRegisterPage({ params: Promise.resolve(params()) })
    ).rejects.toThrow('NEXT_REDIRECT:/events/learn-to-sail-class-1-2-3');
  });

  it('offers the waitlist action when a managed sailor has no active entry', async () => {
    mocks.eventUsesLearnToSailWaitlist.mockReturnValue(true);
    const { default: EventRegisterPage } = await import('./page');

    render(await EventRegisterPage({ params: Promise.resolve(params()) }));

    expect(mocks.waitlistFindFirst).toHaveBeenCalledWith({
      orderBy: { sequence: 'asc' },
      select: { sequence: true },
      where: {
        seasonYear: 2026,
        status: LearnToSailWaitlistEntryStatus.active,
        userId: 'user-1',
      },
    });
    expect(
      screen.getByRole('button', {
        name: 'MitSailingEvents.learn_to_sail_join_waitlist_button',
      })
    ).toBeVisible();
    expect(mocks.EventRegistrationForm).not.toHaveBeenCalled();
  });

  it('shows the closed waitlist message when Learn-to-Sail waitlist is not open', async () => {
    mocks.eventUsesLearnToSailWaitlist.mockReturnValue(true);
    mocks.isLearnToSailWaitlistOpen.mockReturnValue(false);
    const { default: EventRegisterPage } = await import('./page');

    render(await EventRegisterPage({ params: Promise.resolve(params()) }));

    expect(
      screen.getByText('MitSailingEvents.learn_to_sail_waitlist_not_open')
    ).toBeVisible();
    expect(
      screen.queryByRole('button', {
        name: 'MitSailingEvents.learn_to_sail_join_waitlist_button',
      })
    ).not.toBeInTheDocument();
    expect(mocks.EventRegistrationForm).not.toHaveBeenCalled();
  });

  it('renders the registration form with profile phone and waitlist position', async () => {
    mocks.eventUsesLearnToSailWaitlist.mockReturnValue(true);
    mocks.waitlistFindFirst.mockResolvedValue({ sequence: 12 });
    const { default: EventRegisterPage } = await import('./page');

    render(
      await EventRegisterPage({
        params: Promise.resolve(params()),
        searchParams: Promise.resolve({ waitlist: 'not_open' }),
      })
    );

    expect(
      screen.getByText('MitSailingEvents.learn_to_sail_waitlist_not_open')
    ).toBeVisible();
    expect(mocks.EventRegistrationForm).toHaveBeenCalledWith(
      expect.objectContaining({
        initialPhone: '617-555-0000',
        learnToSailWaitlistPosition: 12,
      }),
      undefined
    );
  });

  it('renders a date-to-be-announced schedule and empty phone when profile phone is missing', async () => {
    mocks.eventUsesLearnToSailWaitlist.mockReturnValue(false);
    mocks.getPublishedEventForPublicBySlug.mockResolvedValue({
      ...event,
      dates: [],
    });
    mocks.userFindUnique.mockResolvedValue(null);
    const { default: EventRegisterPage } = await import('./page');

    render(await EventRegisterPage({ params: Promise.resolve(params()) }));

    expect(
      screen.getByText('MitSailingEvents.date_to_be_announced')
    ).toBeVisible();
    expect(mocks.EventRegistrationForm).toHaveBeenCalledWith(
      expect.objectContaining({
        initialPhone: null,
        learnToSailWaitlistPosition: null,
      }),
      undefined
    );
  });

  it('shows registration errors without redirecting unavailable states', async () => {
    mocks.eventUsesLearnToSailWaitlist.mockReturnValue(false);
    mocks.eventRegistrationErrorMessage.mockReturnValue('Already registered');
    mocks.parseEventRegistrationMutationCode.mockReturnValue(
      'already_registered'
    );
    mocks.publicEventReservationState.mockReturnValue('closed');
    const { default: EventRegisterPage } = await import('./page');

    render(
      await EventRegisterPage({
        params: Promise.resolve(params()),
        searchParams: Promise.resolve({ registration: 'already_registered' }),
      })
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Already registered');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('returns not found for missing events', async () => {
    mocks.getPublishedEventForPublicBySlug.mockResolvedValue(null);
    const { default: EventRegisterPage } = await import('./page');

    await expect(
      EventRegisterPage({ params: Promise.resolve(params('missing')) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
