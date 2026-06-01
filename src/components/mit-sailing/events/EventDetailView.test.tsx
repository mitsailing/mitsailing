import { render, screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PublicEventDetail } from '@/libs/mit-sailing/eventQueries';
import messages from '@/locales/en.json';
import { EventDetailView } from './EventDetailView';

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(
    async (options: { locale: string; namespace: keyof typeof messages }) => {
      await Promise.resolve();
      return createTranslator({
        locale: options.locale,
        messages,
        namespace: options.namespace,
      });
    }
  ),
}));

vi.mock('@/components/mit-sailing/admin/PublicAdminEditLink', () => ({
  PublicAdminEditLink: () => null,
}));

vi.mock('@/libs/I18nNavigation', () => ({
  Link: (props: React.ComponentProps<'a'>) => {
    const { children, ...anchorProps } = props;
    return <a {...anchorProps}>{children}</a>;
  },
}));

vi.mock('@/libs/mit-sailing/eventRegistrationActions', () => ({
  cancelPublicEventRegistrationAction: vi.fn(),
}));

function expectElementBefore(first: Element, second: Element): void {
  const orderedElements = [...document.body.querySelectorAll('*')];
  expect(orderedElements.indexOf(first)).toBeLessThan(
    orderedElements.indexOf(second)
  );
}

function eventFixture(
  overrides: Partial<PublicEventDetail> = {}
): PublicEventDetail {
  return {
    admins: [],
    attendees: {
      approved: [],
      pending: [],
    },
    approvedRegistrationCount: 0,
    category: { name: 'Racing' },
    dates: [],
    description: 'Race around the harbor.',
    detailPageKind: 'standard',
    entryFees: [],
    externalDetailUrl: null,
    externalEntriesUrl: null,
    externalRegistrationUrl: null,
    id: 'event-1',
    isSpecial: false,
    maxParticipants: null,
    name: 'Harbor Regatta',
    pendingRegistrationCount: 0,
    publicContentSections: [],
    registrationEnd: null,
    registrationMode: 'standard',
    registrationQuestions: [],
    registrationStart: null,
    requiresApproval: false,
    requiresPhone: false,
    shortName: 'Harbor Regatta',
    slug: 'harbor-regatta',
    teamRegistration: {
      allowRepeatTeamCaptain: false,
      boatsPerTeam: 1,
      personsPerBoat: 1,
      usesTeamRegistration: false,
    },
    ...overrides,
  };
}

describe('EventDetailView', () => {
  it('renders public content sections as rich text', async () => {
    const eventWithSections = eventFixture({
      publicContentSections: [
        {
          body: '<p>Ask the <strong>race desk</strong>.</p>',
          id: 'faq',
          titleKey: 'content_faq_title',
        },
        {
          body: '<p>Notice includes <a href="/events">course details</a>.</p>',
          id: 'noticeOfRace',
          titleKey: 'content_notice_of_race_title',
        },
        {
          body: '<ul><li>Check in on channel 72.</li></ul>',
          id: 'sailingInstructions',
          titleKey: 'content_sailing_instructions_title',
        },
        {
          body: '<p>Posted after racing.</p>',
          id: 'results',
          titleKey: 'content_results_title',
        },
      ],
    });

    render(
      await EventDetailView({
        currentRegistration: null,
        errorCode: null,
        event: eventWithSections,
        isSignedIn: false,
        locale: 'en',
      })
    );

    expect(screen.getByRole('heading', { name: 'FAQ' })).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Notice of Race' })
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Sailing Instructions' })
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Results' })).toBeVisible();
    expect(screen.getByText('race desk').tagName).toBe('STRONG');
    expect(
      screen.getByRole('link', { name: 'course details' })
    ).toHaveAttribute('href', '/events');
    expect(screen.getByText('Check in on channel 72.')).toBeVisible();
  });

  it('omits missing and empty public content sections', async () => {
    render(
      await EventDetailView({
        currentRegistration: null,
        errorCode: null,
        event: eventFixture({
          publicContentSections: [
            {
              body: '<p>Ask at check-in.</p>',
              id: 'faq',
              titleKey: 'content_faq_title',
            },
            {
              body: '',
              id: 'noticeOfRace',
              titleKey: 'content_notice_of_race_title',
            },
          ],
        }),
        isSignedIn: false,
        locale: 'en',
      })
    );

    expect(screen.getByRole('heading', { name: 'FAQ' })).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Notice of Race' })
    ).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'Sailing Instructions' })
    ).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Results' })).toBeNull();
  });

  it('renders external registration links for external registration mode', async () => {
    render(
      await EventDetailView({
        currentRegistration: null,
        errorCode: null,
        event: eventFixture({
          externalEntriesUrl: 'https://example.com/entries',
          externalRegistrationUrl: 'https://example.com/register',
          registrationMode: 'external',
        }),
        isSignedIn: true,
        locale: 'en',
      })
    );

    expect(
      screen.getByRole('link', { name: 'Visit external registration page' })
    ).toHaveAttribute('href', 'https://example.com/register');
    expect(screen.getByRole('link', { name: 'View entries' })).toHaveAttribute(
      'href',
      'https://example.com/entries'
    );
    expect(screen.queryByRole('link', { name: 'Register' })).toBeNull();
  });

  it('keeps event facts above the description without repeating them later', async () => {
    render(
      await EventDetailView({
        currentRegistration: null,
        errorCode: null,
        event: eventFixture({
          addressCity: 'Cambridge',
          addressCountry: 'US',
          addressLine1: '134 Memorial Drive',
          addressLine2: null,
          addressName: 'MIT Sailing Pavilion',
          addressPostalCode: '02139',
          addressState: 'MA',
          admins: [
            {
              admin: {
                email: 'race@example.com',
                id: 'admin-1',
                name: 'Race Chair',
              },
              id: 'event-admin-1',
            },
          ],
          approvedRegistrationCount: 7,
          attendees: {
            approved: [
              { id: 'registration-1', image: null, name: 'Ada Lovelace' },
              {
                id: 'registration-2',
                image: '/avatars/grace.jpg',
                name: 'Grace Hopper',
              },
            ],
            pending: [
              { id: 'registration-3', image: null, name: 'Alan Turing' },
            ],
          },
          dates: [
            {
              endDateTime: new Date('2026-06-02T18:00:00Z'),
              id: 'date-1',
              startDateTime: new Date('2026-06-02T14:00:00Z'),
            },
          ],
          entryFees: [
            {
              amountCents: 15_000,
              description: 'Adult entry',
              id: 'fee-1',
              isDeposit: false,
            },
          ],
          maxParticipants: 10,
          pendingRegistrationCount: 2,
          registrationEnd: new Date('2099-06-01T16:00:00Z'),
          registrationStart: new Date('2026-05-20T16:00:00Z'),
        }),
        isSignedIn: true,
        locale: 'en',
      })
    );

    const schedule = screen.getByText('Jun 2, 2026, 10:00 AM – 2:00 PM');
    const host = screen.getByText('Race Chair');
    const location = screen.getByText(/MIT Sailing Pavilion/);
    const going = screen.getByText('Going');
    const description = screen.getByText('Race around the harbor.');

    expect(screen.getByText('Race Chair')).toBeVisible();
    expect(screen.getByText(/MIT Sailing Pavilion/)).toBeVisible();
    expect(screen.getByText('Going')).toBeVisible();
    expect(screen.getByLabelText('Ada Lovelace')).toBeVisible();
    expect(screen.getByLabelText('Grace Hopper')).toBeVisible();
    expect(screen.getByText('Pending approval')).toBeVisible();
    expect(screen.getByLabelText('Alan Turing')).toBeVisible();
    expectElementBefore(schedule, description);
    expectElementBefore(host, description);
    expectElementBefore(location, description);
    expectElementBefore(going, description);
    expect(
      screen.queryByRole('region', { name: 'Event at a glance' })
    ).toBeNull();
    expect(screen.getByRole('heading', { name: 'Entry fees' })).toBeVisible();
    expect(screen.getByText('$150.00')).toBeVisible();
    expect(screen.getByText('7 / 10 confirmed')).toBeVisible();
    expect(screen.getAllByText('Capacity')).toHaveLength(1);
    expect(screen.queryByText('Opened')).toBeNull();
    expect(screen.getByText(/134 Memorial Drive/)).toBeVisible();

    const registrationPanel = screen.getByRole('region', {
      name: 'Reserve your spot',
    });
    expect(within(registrationPanel).queryByText('Opened')).toBeNull();
    expect(
      within(registrationPanel).queryByText('Jun 2, 2026, 10:00 AM – 2:00 PM')
    ).toBeNull();
    expect(
      within(registrationPanel).queryByText('MIT Sailing Pavilion')
    ).toBeNull();
  });

  it('hides short name on the detail page', async () => {
    render(
      await EventDetailView({
        currentRegistration: null,
        errorCode: null,
        event: eventFixture({
          name: 'Intercollegiate Overnight Series',
          shortName: 'Overnight Series',
        }),
        isSignedIn: true,
        locale: 'en',
      })
    );

    expect(
      screen.getByRole('heading', {
        name: 'Intercollegiate Overnight Series',
      })
    ).toBeVisible();
    expect(screen.queryByText('Overnight Series')).toBeNull();
  });

  it('omits unsafe external registration links', async () => {
    const unsafeScriptHref = `${['java', 'script'].join('')}:alert(1)`;

    render(
      await EventDetailView({
        currentRegistration: null,
        errorCode: null,
        event: eventFixture({
          externalEntriesUrl: 'mailto:entries@example.com',
          externalRegistrationUrl: unsafeScriptHref,
          registrationMode: 'external',
        }),
        isSignedIn: true,
        locale: 'en',
      })
    );

    expect(
      screen.queryByRole('link', { name: 'Visit external registration page' })
    ).toBeNull();
    expect(screen.queryByRole('link', { name: 'View entries' })).toBeNull();
    expect(
      screen.getByText('Registration is not available for this event.')
    ).toBeVisible();
  });

  it('renders unavailable registration copy without local registration cta', async () => {
    render(
      await EventDetailView({
        currentRegistration: null,
        errorCode: null,
        event: eventFixture({
          registrationMode: 'none',
        }),
        isSignedIn: true,
        locale: 'en',
      })
    );

    expect(
      screen.getByText('Registration is not available for this event.')
    ).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Register' })).toBeNull();
    expect(
      screen.queryByRole('link', { name: 'Request to register' })
    ).toBeNull();
  });
});
