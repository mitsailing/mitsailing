import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTranslator } from 'next-intl';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EventRegistrationStatus } from '@/generated/prisma/enums';
import messages from '@/locales/en.json';
import { AdminEventRegistrationsView } from './AdminEventRegistrationsView';

vi.mock('@/libs/admin/events/eventAdminActions', () => ({
  resendAllAdminEventPaymentRequestsAction: vi.fn(),
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
  accessMode: AdminEventRegistrationsViewProps['accessMode'],
  options: { learnToSailWaitlistNumber?: number | null } = {}
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
            learnToSailWaitlistNumber:
              options.learnToSailWaitlistNumber ?? null,
            payment: null,
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
  it('renders registrations in page-flow roster cards with row-local actions and answers', () => {
    renderView('editable');

    const roster = screen.getByRole('list', { name: 'Registration roster' });

    expect(screen.queryByRole('table')).toBeNull();
    expect(within(roster).getByText('Attendee')).toBeVisible();
    expect(within(roster).getByText('Status')).toBeVisible();
    expect(within(roster).getByText('Registered')).toBeVisible();
    expect(within(roster).getByText('Phone')).toBeVisible();
    expect(within(roster).getByText('Fee')).toBeVisible();
    expect(within(roster).getByText('Team and boat')).toBeVisible();
    expect(within(roster).getByText('Swim agreement')).toBeVisible();
    expect(within(roster).getByText('Dietary restrictions?')).toBeVisible();
    expect(within(roster).getByText('Sailing experience?')).toBeVisible();
    expect(within(roster).getByText('617-555-0100')).toBeVisible();
    expect(within(roster).getByText('Adult entry')).toBeVisible();
    expect(within(roster).getByText('$150.00')).toBeVisible();
    expect(within(roster).getByText('Fast Team')).toBeVisible();
    expect(within(roster).getByText('Boat 1')).toBeVisible();
    expect(within(roster).getByText('Helm')).toBeVisible();
    expect(within(roster).getByText('Helm One')).toBeVisible();
    expect(within(roster).getByText('helm@example.com')).toBeVisible();
    expect(within(roster).getByText('Crew')).toBeVisible();
    expect(within(roster).getByText('Crew One')).toBeVisible();
    expect(within(roster).getByText('crew@example.com')).toBeVisible();
    expect(screen.getAllByLabelText('Actions for Sailor One').length).toBe(1);
  });

  it('keeps mobile review in one roster list instead of nested answer tables', () => {
    renderView('editable');

    expect(
      screen.getByRole('list', { name: 'Registration roster' })
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

  it('shows Learn-to-Sail waitlist numbers in the roster', () => {
    renderView('editable', { learnToSailWaitlistNumber: 184 });

    const roster = screen.getByRole('list', { name: 'Registration roster' });

    expect(within(roster).getByText('Waitlist number')).toBeVisible();
    expect(within(roster).getByText('#184')).toBeVisible();
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

    const dialog = screen.getByRole('dialog', {
      name: 'Confirm approve for Sailor One',
    });

    expect(
      within(dialog).getByText('Approve Sailor One and mark confirmed?')
    ).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Confirm approve' })
    ).toBeVisible();
  });

  it('shows roster and answers without mutation controls for read-only access', () => {
    renderView('readOnly');

    expect(screen.getByText('Read-only access')).toBeVisible();
    expect(screen.getAllByText('Sailor One').length).toBeGreaterThan(0);
    expect(screen.getAllByText('sailor@example.com').length).toBeGreaterThan(0);
    expect(screen.getByText('Dietary restrictions?')).toBeVisible();
    expect(screen.getByText('Vegetarian')).toBeVisible();
    expect(screen.queryByLabelText('Actions for Sailor One')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
  });

  it('shows bulk email as an active composing surface', () => {
    renderView('editable');

    const bulkEmail = screen.getByRole('region', { name: 'Bulk email' });

    expect(
      within(bulkEmail).getByRole('textbox', { name: 'Subject' })
    ).toBeEnabled();
    expect(
      within(bulkEmail).getByRole('textbox', { name: 'Message' })
    ).toBeEnabled();
    expect(
      within(bulkEmail).getByRole('button', { name: 'Send' })
    ).toBeEnabled();
  });
});
