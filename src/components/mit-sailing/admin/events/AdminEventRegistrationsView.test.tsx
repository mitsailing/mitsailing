import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTranslator } from 'next-intl';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EventRegistrationStatus } from '@/generated/prisma/enums';
import messages from '@/locales/en.json';
import { AdminEventRegistrationsView } from './AdminEventRegistrationsView';

vi.mock('@/libs/admin/events/eventAdminActions', () => ({
  updateAdminEventRegistrationStatusAction: vi.fn(),
}));

type AdminEventRegistrationsViewProps = React.ComponentProps<
  typeof AdminEventRegistrationsView
>;

const t = createTranslator({
  locale: 'en',
  messages,
  namespace: 'AdminEvents',
});

function firstElement<T>(elements: T[]): T {
  const [element] = elements;
  if (!element) {
    throw new Error('Expected at least one element.');
  }
  return element;
}

function renderView(
  accessMode: AdminEventRegistrationsViewProps['accessMode']
) {
  return render(
    <AdminEventRegistrationsView
      accessMode={accessMode}
      errorCode={null}
      event={{
        id: 'event-1',
        name: 'Intro Sail',
        questions: [
          {
            answerType: 'text',
            displayOrder: 1,
            id: 'question-1',
            options: [],
            questionText: 'Dietary restrictions?',
            required: false,
          },
          {
            answerType: 'select',
            displayOrder: 2,
            id: 'question-2',
            options: ['Beginner', 'Intermediate'],
            questionText: 'Sailing experience?',
            required: true,
          },
        ],
        registrationCounts: {
          approved: 0,
          cancelled: 0,
          pending: 1,
        },
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
              {
                id: 'answer-2',
                question: {
                  displayOrder: 2,
                  id: 'question-2',
                  questionText: 'Sailing experience?',
                },
                value: 'Beginner',
              },
            ],
            createdAt: new Date('2026-05-01T12:00:00Z'),
            entryFee: {
              amountCents: 15_000,
              description: 'Adult entry',
              id: 'fee-adult',
              isDeposit: false,
            },
            id: 'registration-1',
            phone: '617-555-0100',
            registrationTeam: {
              id: 'team-1',
              teamName: 'Fast Team',
            },
            boatMembers: [
              {
                id: 'member-1',
                boatNumber: 1,
                position: 0,
                positionLabel: 'helm',
                fullName: 'Helm One',
                email: 'helm@example.com',
              },
              {
                id: 'member-2',
                boatNumber: 1,
                position: 1,
                positionLabel: 'crew',
                fullName: 'Crew One',
                email: 'crew@example.com',
              },
            ],
            status: EventRegistrationStatus.pending,
            swimAgreementAcceptedAt: new Date('2026-05-01T12:01:00Z'),
            user: {
              email: 'sailor@example.com',
              id: 'user-1',
              name: 'Sailor One',
            },
          },
        ],
        entryFees: [
          {
            amountCents: 15_000,
            description: 'Adult entry',
            id: 'fee-adult',
            isDeposit: false,
          },
          {
            amountCents: 9000,
            description: 'Junior entry',
            id: 'fee-junior',
            isDeposit: true,
          },
        ],
        requiresPhone: true,
        slug: 'intro-sail',
        usesTeamRegistration: true,
      }}
      filter="all"
      locale="en"
      t={t}
    />
  );
}

describe('AdminEventRegistrationsView', () => {
  it('renders registrations in a dense table with row-local actions and question columns', () => {
    renderView('editable');

    const table = screen.getByRole('table', { name: 'Registration roster' });

    expect(
      within(table).getByRole('columnheader', { name: 'Attendee' })
    ).toBeVisible();
    expect(
      within(table).getByRole('columnheader', { name: 'Status' })
    ).toBeVisible();
    expect(
      within(table).getByRole('columnheader', { name: 'Registered' })
    ).toBeVisible();
    expect(
      within(table).getByRole('columnheader', { name: 'Phone' })
    ).toBeVisible();
    expect(
      within(table).getByRole('columnheader', { name: 'Fee' })
    ).toBeVisible();
    expect(
      within(table).getByRole('columnheader', { name: 'Team and boat' })
    ).toBeVisible();
    expect(
      within(table).getByRole('columnheader', { name: 'Swim agreement' })
    ).toBeVisible();
    expect(
      within(table).getByRole('columnheader', {
        name: 'Dietary restrictions?',
      })
    ).toBeVisible();
    expect(
      within(table).getByRole('columnheader', { name: 'Sailing experience?' })
    ).toBeVisible();
    expect(within(table).getByText('617-555-0100')).toBeVisible();
    expect(within(table).getByText('Adult entry')).toBeVisible();
    expect(within(table).getByText('$150.00')).toBeVisible();
    expect(within(table).getByText('Fast Team')).toBeVisible();
    expect(within(table).getByText('Boat 1')).toBeVisible();
    expect(within(table).getByText('Helm')).toBeVisible();
    expect(within(table).getByText('Helm One')).toBeVisible();
    expect(within(table).getByText('helm@example.com')).toBeVisible();
    expect(within(table).getByText('Crew')).toBeVisible();
    expect(within(table).getByText('Crew One')).toBeVisible();
    expect(within(table).getByText('crew@example.com')).toBeVisible();
    expect(screen.getAllByLabelText('Actions for Sailor One').length).toBe(1);
  });

  it('keeps mobile review in one roster table instead of per-attendee answer tables', () => {
    renderView('editable');

    expect(
      screen.getByRole('table', { name: 'Registration roster' })
    ).toBeVisible();
    expect(screen.queryByLabelText('View answers for Sailor One')).toBeNull();
    expect(
      screen.queryByRole('table', { name: 'Answers for Sailor One' })
    ).toBeNull();
    expect(
      screen.queryByRole('table', { name: 'Team for Sailor One' })
    ).toBeNull();
    expect(screen.getByText('Vegetarian')).toBeVisible();
  });

  it('links attendee phone numbers with tel protocol', () => {
    renderView('editable');

    const phoneLink = screen.getByRole('link', { name: '617-555-0100' });

    expect(phoneLink).toHaveAttribute('href', 'tel:617-555-0100');
  });

  it('asks for confirmation before approving a registration', async () => {
    const user = userEvent.setup();
    renderView('editable');

    const actionsMenu = firstElement(
      screen.getAllByLabelText('Actions for Sailor One')
    );
    const approveAction = firstElement(screen.getAllByText('Approve'));

    await user.click(actionsMenu);
    await user.click(approveAction);

    const dialog = firstElement(
      screen.getAllByRole('dialog', {
        name: 'Confirm approve for Sailor One',
      })
    );
    expect(dialog).toHaveTextContent('Approve Sailor One and mark confirmed?');
    expect(
      within(dialog).getByRole('button', { name: 'Confirm approve' })
    ).toBeVisible();
  });

  it('shows roster and answers without mutation controls for read-only access', () => {
    renderView('readOnly');

    expect(screen.getByText('Read-only access')).toBeVisible();
    expect(screen.getByText('Sailor One')).toBeVisible();
    expect(screen.getByText('sailor@example.com')).toBeVisible();
    expect(screen.getByText('Dietary restrictions?')).toBeVisible();
    expect(screen.getByText('Vegetarian')).toBeVisible();
    expect(screen.queryByLabelText('Actions for Sailor One')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
  });
});
