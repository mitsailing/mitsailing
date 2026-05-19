import { render, screen } from '@testing-library/react';
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

function eventFixture(
  overrides: Partial<PublicEventDetail> = {}
): PublicEventDetail {
  return {
    admins: [],
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
    shortName: 'Harbor Regatta',
    slug: 'harbor-regatta',
    ...overrides,
  };
}

describe('EventDetailView', () => {
  it('renders public content sections as rich text', async () => {
    render(
      await EventDetailView({
        currentRegistration: null,
        errorCode: null,
        event: eventFixture({
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
        }),
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
