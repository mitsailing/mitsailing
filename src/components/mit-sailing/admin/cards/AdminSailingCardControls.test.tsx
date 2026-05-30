import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as ReactModule from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SailingCardType } from '@/generated/prisma/enums';
import type { AdminSailingCardActionState } from '@/libs/admin/cards/adminSailingCardActions';
import {
  AdminSailingCardExpireForm,
  AdminSailingCardHistory,
  AdminSailingCardIssueForm,
} from './AdminSailingCardControls';

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
      error_card_number_duplicate: 'That card number is already in use.',
      error_card_number_invalid: 'Enter a positive card number.',
      error_missing_onboarding_agreement:
        'Missing onboarding agreement acceptance.',
      error_mit_recreation_required:
        'Verify MIT Recreation before issuing Normal.',
      error_no_current_card: 'No current card.',
      error_not_found: 'User was not found.',
      error_payment_required: 'Enter a note before issuing without payment.',
      issue_form_label: 'Issue sailing card',
      card_type_normal: 'Normal',
      card_type_racing: 'Pavilion racing',
      card_type_team_racing: 'Thursday team racing',
      history_empty: 'No previous cards.',
      history_heading: 'Card history',
      history_row: `Card #${number} for ${year}`,
      payment_bypass_note_label: 'Payment bypass note',
      payment_bypass_note_placeholder: 'Required when issuing without payment',
    };
    return messages[key] ?? key;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  actionStateMock.state = { fieldErrors: {}, status: 'idle' };
});

describe('AdminSailingCardControls', () => {
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
});
