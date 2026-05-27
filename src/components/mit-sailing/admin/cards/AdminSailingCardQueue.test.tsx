import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as ReactModule from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SailingAffiliation } from '@/generated/prisma/enums';
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
      column_email: 'Email',
      column_agreement_acceptance: 'Agreement',
      column_mit_id: 'MIT ID',
      column_name: 'Name',
      column_requested_at: 'Requested',
      column_suggested_card: 'Suggested card',
      empty_queue: 'No pending card requests.',
      error_card_number_duplicate: 'That card number is already in use.',
      error_card_number_invalid: 'Enter a positive card number.',
      error_missing_onboarding_agreement:
        'Missing onboarding agreement acceptance.',
      error_no_current_card: 'No current card.',
      error_not_found: 'User was not found.',
      history_empty: 'No previous cards.',
      history_heading: 'Card history',
      history_row: `Card #${number} for ${year}`,
    };
    return messages[key] ?? key;
  },
}));

const queueRow = {
  email: 'ada@mit.edu',
  id: 'user-1',
  agreementAcceptedAt: new Date('2026-05-21T16:00:00.000Z'),
  agreementVersion: 'v1',
  mitId: '123456789',
  name: 'Ada Lovelace',
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
        canExpireCards={false}
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
    expect(screen.getByText('123456789')).toBeInTheDocument();
    expect(screen.getByText(/v1/)).toBeInTheDocument();
    expect(screen.getAllByText(/May 21, 2026/)).toHaveLength(2);
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.queryByText('AK')).not.toBeInTheDocument();
  });

  it('does not render expire action for pending requests', () => {
    render(
      <AdminSailingCardQueue
        canAssignCards={false}
        canExpireCards
        locale="en"
        rows={[queueRow]}
        suggestedCardNumber={60}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Expire' })
    ).not.toBeInTheDocument();
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

  it('renders issue form-level errors', () => {
    actionStateMock.state = {
      fieldErrors: {},
      formError: 'missing_onboarding_agreement',
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
      'Missing onboarding agreement acceptance.'
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
});
