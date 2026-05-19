import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EventRegistrationStatus } from '@/generated/prisma/enums';
import messages from '@/locales/en.json';
import { AdminEventShowView } from './AdminEventShowView';

vi.mock('@/libs/admin/events/eventAdminActions', () => ({
  updateAdminEventRegistrationStatusAction: vi.fn(),
}));

vi.mock('@/libs/I18nNavigation', () => ({
  Link: (props: React.ComponentProps<'a'>) => {
    const { children, ...anchorProps } = props;
    return <a {...anchorProps}>{children}</a>;
  },
}));

type AdminEventShowViewProps = React.ComponentProps<typeof AdminEventShowView>;

const t = createTranslator({
  locale: 'en',
  messages,
  namespace: 'AdminEvents',
});

function eventFixture(
  accessMode: AdminEventShowViewProps['event']['accessMode']
): AdminEventShowViewProps['event'] {
  return {
    accessMode,
    admins: [
      {
        admin: {
          email: 'instructor@example.com',
          id: 'instructor-1',
          name: 'Sailing Instructor',
        },
        adminUserId: 'instructor-1',
        id: 'event-admin-1',
      },
    ],
    category: { id: 'category-1', name: 'Clinic' },
    dates: [
      {
        endDateTime: new Date('2026-06-01T15:00:00Z'),
        id: 'date-1',
        startDateTime: new Date('2026-06-01T13:00:00Z'),
      },
    ],
    description: 'Learn how to sail.',
    detailPageKind: 'standard',
    externalDetailUrl: null,
    id: 'event-1',
    isPublished: true,
    isSpecial: false,
    maxParticipants: 12,
    name: 'Intro Sail',
    publicContentSections: [
      {
        body: 'Learn how to sail.',
        id: 'description',
        titleKey: 'content_description_title',
      },
    ],
    registrationCounts: {
      approved: 3,
      cancelled: 1,
      pending: 2,
    },
    registrationEnd: new Date('2026-05-31T04:00:00Z'),
    registrationStart: new Date('2026-05-01T04:00:00Z'),
    registrations: [
      {
        answers: [
          {
            id: 'answer-1',
            question: {
              displayOrder: 1,
              id: 'question-1',
              questionText: 'Dietary restrictions?',
            },
            value: 'Vegetarian',
          },
        ],
        createdAt: new Date('2026-05-01T12:00:00Z'),
        id: 'registration-1',
        status: EventRegistrationStatus.pending,
        swimAgreementAcceptedAt: new Date('2026-05-01T12:01:00Z'),
        user: {
          email: 'sailor@example.com',
          id: 'user-1',
          name: 'Sailor One',
        },
      },
    ],
    requiresApproval: true,
    shortName: 'Intro',
    slug: 'intro-sail',
    questions: [
      {
        answerType: 'text',
        displayOrder: 1,
        id: 'question-1',
        options: [],
        questionText: 'Dietary restrictions?',
        required: false,
      },
    ],
  };
}

describe('AdminEventShowView', () => {
  it('renders summary content actions and embedded registration review', () => {
    render(
      <AdminEventShowView
        errorCode={null}
        event={eventFixture('editable')}
        filter="all"
        locale="en"
        t={t}
      />
    );

    expect(screen.getByRole('heading', { name: 'Intro Sail' })).toBeVisible();
    expect(screen.getByText('Published')).toBeVisible();
    expect(screen.getByText('Signed up')).toBeVisible();
    expect(screen.getByText('5')).toBeVisible();
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    expect(screen.getByText('Awaiting confirmation')).toBeVisible();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getByText('Remaining')).toBeVisible();
    expect(screen.getByText('9')).toBeVisible();
    expect(screen.getByText('Sailing Instructor')).toBeVisible();
    expect(screen.getByRole('link', { name: /edit/i })).toHaveAttribute(
      'href',
      '/admin/events/intro-sail/edit'
    );
    expect(
      screen.getByRole('link', { name: /view public page/i })
    ).toHaveAttribute('href', '/events/intro-sail');
    expect(screen.getByRole('link', { name: /delete/i })).toHaveAttribute(
      'href',
      '/admin/events/intro-sail/delete'
    );
    expect(screen.getByText('Learn how to sail.')).toBeVisible();
    expect(
      screen.getByRole('table', { name: 'Registration roster' })
    ).toBeVisible();
  });

  it('hides mutation actions for read-only access', () => {
    render(
      <AdminEventShowView
        errorCode={null}
        event={eventFixture('readOnly')}
        filter="all"
        locale="en"
        t={t}
      />
    );

    expect(screen.getByText('Read-only access')).toBeVisible();
    expect(screen.queryByRole('link', { name: /edit/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /delete/i })).toBeNull();
    expect(screen.queryByLabelText('Actions for Sailor One')).toBeNull();
    expect(screen.getAllByText('Vegetarian').length).toBeGreaterThan(0);
  });
});
