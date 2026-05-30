import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as ReactModule from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SailingAffiliation, SailingCardType } from '@/generated/prisma/enums';
import type { AdminSailingCardActionState } from '@/libs/admin/cards/adminSailingCardActions';
import {
  AdminSailingCardExpireForm,
  AdminSailingCardHistory,
  AdminSailingCardIssueForm,
  AdminSailingCardQueue,
} from './AdminSailingCardQueue';

vi.mock('server-only', () => ({}));

const actionStateMock = vi.hoisted(() => ({
  formAction: vi.fn(),
  state: { fieldErrors: {}, status: 'idle' } as AdminSailingCardActionState,
}));

vi.mock('@/libs/admin/cards/adminSailingCardActions', () => ({
  expireSailingCardAction: vi.fn(),
  issueSailingCardAction: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    useActionState: vi.fn(() => [
      actionStateMock.state,
      actionStateMock.formAction,
    ]),
  };
});

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const number = typeof values?.number === 'number' ? values.number : '';
    const year = typeof values?.year === 'number' ? values.year : '';
    const messages: Record<string, string> = {
      action_expire: 'Expire',
      action_issue: 'Issue',
      action_issue_pending: 'Issuing',
      card_number_label: 'Card number',
      card_number_placeholder: `Auto ${number}`,
      column_affiliation: 'Affiliation',
      column_agreement_acceptance: 'Agreement',
      column_card_type: 'Card type',
      column_email: 'Email',
      column_fitness_membership: 'MIT Recreation',
      column_mit_id: 'MIT ID',
      column_name: 'Name',
      column_payment_access: 'Payment access',
      column_requested_at: 'Requested',
      column_suggested_card: 'Suggested card',
      empty_queue: 'No pending card requests.',
      error_card_number_duplicate: 'That card number is already in use.',
      error_card_number_invalid: 'Enter a positive card number.',
      error_missing_onboarding_agreement:
        'Missing onboarding agreement acceptance.',
      error_mit_recreation_required:
        'Verify MIT Recreation before issuing Normal.',
      error_no_current_card: 'No current card.',
      error_not_found: 'User was not found.',
      error_payment_required: 'Enter a note before issuing without payment.',
      filter_empty: 'No pending card requests match that search.',
      filter_search_label: 'Search pending requests',
      filter_search_placeholder: 'Search by name, email, or MIT ID',
      fitness_membership_mit_student: 'MIT student',
      fitness_membership_no_verify: 'No, verify before issuing',
      fitness_membership_not_required: 'Not required',
      fitness_membership_yes: 'Yes',
      issue_form_label: 'Issue sailing card',
      card_type_normal: 'Normal',
      card_type_racing: 'Pavilion racing',
      card_type_team_racing: 'Thursday team racing',
      history_empty: 'No previous cards.',
      history_heading: 'Card history',
      history_row: `Card #${number} for ${year}`,
      payment_bypass_note_label: 'Payment bypass note',
      payment_bypass_note_placeholder: 'Required when issuing without payment',
      payment_access_blocked: 'Payment needs review',
      payment_access_none: 'No payment',
      payment_access_paid: 'Paid',
    };
    return messages[key] ?? key;
  },
}));

const queueRow = {
  email: 'ada@mit.edu',
  id: 'user-1',
  agreementAcceptedAt: new Date('2026-05-21T16:00:00.000Z'),
  agreementVersion: 'v1',
  cardType: SailingCardType.normal,
  hasFitnessMembership: null,
  mitId: '123456789',
  name: 'Ada Lovelace',
  paymentAccess: 'none' as const,
  requestedAt: new Date('2026-05-21T16:00:00.000Z'),
  sailingAffiliation: SailingAffiliation.MIT_STUDENT,
};

beforeEach(() => {
  vi.clearAllMocks();
  actionStateMock.state = { fieldErrors: {}, status: 'idle' };
});

describe('AdminSailingCardQueue', () => {
  it('lists pending users with card request details and suggested number', () => {
    render(
      <AdminSailingCardQueue
        canAssignCards
        locale="en"
        rows={[queueRow]}
        suggestedCardNumber={60}
      />
    );

    expect(screen.getByRole('link', { name: 'Ada Lovelace' })).toHaveAttribute(
      'href',
      '/admin/users/user-1'
    );
    expect(screen.getByText('ada@mit.edu')).toBeInTheDocument();
    expect(
      screen.getByText(SailingAffiliation.MIT_STUDENT)
    ).toBeInTheDocument();
    expect(screen.getByText('Normal')).toBeInTheDocument();
    expect(screen.getByText('MIT student')).toBeInTheDocument();
    expect(screen.getByText('123456789')).toBeInTheDocument();
    expect(screen.getByText('No payment')).toBeInTheDocument();
    expect(screen.getByText(/v1/)).toBeInTheDocument();
    expect(screen.getAllByText(/May 21, 2026/)).toHaveLength(2);
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.queryByText('AK')).not.toBeInTheDocument();
  });

  it('flags normal requests that need mit recreation verification', () => {
    render(
      <AdminSailingCardQueue
        canAssignCards
        locale="en"
        rows={[
          {
            ...queueRow,
            hasFitnessMembership: false,
            sailingAffiliation: SailingAffiliation.MIT_ALUM,
          },
        ]}
        suggestedCardNumber={60}
      />
    );

    expect(screen.getByText('No, verify before issuing')).toBeInTheDocument();
  });

  it('does not require mit recreation for racing requests', () => {
    render(
      <AdminSailingCardQueue
        canAssignCards
        locale="en"
        rows={[
          {
            ...queueRow,
            cardType: SailingCardType.racing,
            hasFitnessMembership: false,
            sailingAffiliation: SailingAffiliation.MIT_ALUM,
          },
        ]}
        suggestedCardNumber={60}
      />
    );

    expect(screen.getByText('Pavilion racing')).toBeInTheDocument();
    expect(screen.getByText('Not required')).toBeInTheDocument();
    expect(
      screen.queryByText('No, verify before issuing')
    ).not.toBeInTheDocument();
  });

  it('shows blocked payment access in pending queue rows', () => {
    render(
      <AdminSailingCardQueue
        canAssignCards
        locale="en"
        rows={[
          {
            ...queueRow,
            cardType: SailingCardType.racing,
            paymentAccess: 'blocked',
          },
        ]}
        suggestedCardNumber={60}
      />
    );

    expect(screen.getByText('Payment needs review')).toBeInTheDocument();
  });

  it('does not render expire action for pending requests', () => {
    render(
      <AdminSailingCardQueue
        canAssignCards={false}
        locale="en"
        rows={[queueRow]}
        suggestedCardNumber={60}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Expire' })
    ).not.toBeInTheDocument();
  });

  it('filters pending requests by name email and mit id without navigation', async () => {
    render(
      <AdminSailingCardQueue
        canAssignCards
        locale="en"
        rows={[
          queueRow,
          {
            ...queueRow,
            email: 'grace@mit.edu',
            id: 'user-2',
            mitId: '987654321',
            name: 'Grace Hopper',
          },
          {
            ...queueRow,
            email: 'katherine@mit.edu',
            id: 'user-3',
            mitId: '456789123',
            name: 'Katherine Johnson',
          },
        ]}
        suggestedCardNumber={60}
      />
    );
    const user = userEvent.setup();
    const originalLocation = window.location.href;
    const search = screen.getByLabelText('Search pending requests');

    await user.type(search, 'grace');

    expect(screen.getByRole('link', { name: 'Grace Hopper' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Ada Lovelace' })).toBeNull();
    expect(
      screen.queryByRole('link', { name: 'Katherine Johnson' })
    ).toBeNull();

    await user.clear(search);
    await user.type(search, 'ada@mit.edu');

    expect(screen.getByRole('link', { name: 'Ada Lovelace' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Grace Hopper' })).toBeNull();

    await user.clear(search);
    await user.type(search, '456789123');

    expect(
      screen.getByRole('link', { name: 'Katherine Johnson' })
    ).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Ada Lovelace' })).toBeNull();
    expect(window.location.href).toBe(originalLocation);
  });

  it('allows blank card number for auto assignment', () => {
    render(
      <AdminSailingCardIssueForm
        action={vi.fn()}
        locale="en"
        suggestedCardNumber={60}
        userId="user-1"
      />
    );

    expect(
      screen.getByRole('form', { name: 'Issue sailing card' })
    ).toBeVisible();
    expect(screen.getByLabelText('Card number')).not.toBeRequired();
    expect(screen.getByLabelText('Card number')).toHaveAttribute(
      'placeholder',
      'Auto 60'
    );
  });

  it('accepts manual card number input', async () => {
    render(
      <AdminSailingCardIssueForm
        action={vi.fn()}
        locale="en"
        suggestedCardNumber={60}
        userId="user-1"
      />
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Card number'), '7');

    expect(screen.getByLabelText('Card number')).toHaveValue(7);
  });

  it('renders payment bypass note for paid pending rows without payment', () => {
    render(
      <AdminSailingCardIssueForm
        action={vi.fn()}
        locale="en"
        paymentAccess="none"
        cardType={SailingCardType.racing}
        suggestedCardNumber={60}
        userId="user-1"
      />
    );

    const note = screen.getByLabelText('Payment bypass note');
    expect(note).toHaveAttribute('name', 'paymentBypassNote');
    expect(note).toBeRequired();
  });

  it('omits payment bypass note for paid pending rows with paid access', () => {
    render(
      <AdminSailingCardIssueForm
        action={vi.fn()}
        locale="en"
        paymentAccess="paid"
        cardType={SailingCardType.racing}
        suggestedCardNumber={60}
        userId="user-1"
      />
    );

    expect(screen.queryByLabelText('Payment bypass note')).toBeNull();
  });

  it('renders issue form-level errors', () => {
    actionStateMock.state = {
      fieldErrors: {},
      formError: 'payment_required',
      status: 'error',
    };

    render(
      <AdminSailingCardIssueForm
        action={vi.fn()}
        locale="en"
        suggestedCardNumber={60}
        userId="user-1"
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a note before issuing without payment.'
    );
  });

  it('renders expire form-level errors', () => {
    actionStateMock.state = {
      fieldErrors: {},
      formError: 'no_current_card',
      status: 'error',
    };

    render(<AdminSailingCardExpireForm locale="en" userId="user-1" />);

    expect(screen.getByRole('alert')).toHaveTextContent('No current card.');
  });

  it('renders previous card numbers from user audit history', () => {
    render(
      <AdminSailingCardHistory
        rows={[
          {
            createdAt: new Date('2026-08-01T16:00:00.000Z'),
            id: 'audit-1',
            number: 42,
            year: 2027,
          },
        ]}
      />
    );

    expect(screen.getByText('Card #42 for 2027')).toBeInTheDocument();
  });

  it('requires payment bypass note for team racing cards without payment', () => {
    render(
      <AdminSailingCardIssueForm
        action={vi.fn()}
        cardType={SailingCardType.team_racing}
        locale="en"
        paymentAccess="none"
        suggestedCardNumber={60}
        userId="user-1"
      />
    );

    const note = screen.getByLabelText('Payment bypass note');
    expect(note).toHaveAttribute('name', 'paymentBypassNote');
    expect(note).toBeRequired();
  });

  it('omits payment bypass note for normal cards without payment', () => {
    render(
      <AdminSailingCardIssueForm
        action={vi.fn()}
        cardType={SailingCardType.normal}
        locale="en"
        paymentAccess="none"
        suggestedCardNumber={60}
        userId="user-1"
      />
    );

    expect(screen.queryByLabelText('Payment bypass note')).toBeNull();
  });

  it('shows paid payment access status without highlighting', () => {
    render(
      <AdminSailingCardQueue
        canAssignCards
        locale="en"
        rows={[
          {
            ...queueRow,
            paymentAccess: 'paid',
          },
        ]}
        suggestedCardNumber={60}
      />
    );

    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('shows empty queue message when there are no pending requests', () => {
    render(
      <AdminSailingCardQueue
        canAssignCards
        locale="en"
        rows={[]}
        suggestedCardNumber={60}
      />
    );

    expect(screen.getByText('No pending card requests.')).toBeInTheDocument();
  });
});
