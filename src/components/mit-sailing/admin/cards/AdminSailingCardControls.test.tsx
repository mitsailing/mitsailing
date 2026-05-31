import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as ReactModule from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SailingCardType } from '@/generated/prisma/enums';
import type { AdminSailingCardActionState } from '@/libs/admin/cards/adminSailingCardActions';
import {
  AdminSailingCardChangeNumberForm,
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
  updateSailingCardNumberAction: vi.fn(),
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
    const fromNumber =
      typeof values?.fromNumber === 'number' ? values.fromNumber : '';
    const toNumber =
      typeof values?.toNumber === 'number' ? values.toNumber : '';
    const date = typeof values?.date === 'string' ? values.date : '';
    const actor = typeof values?.actor === 'string' ? values.actor : '';
    const messages: Record<string, string> = {
      action_expire: 'Expire',
      action_issue: 'Issue',
      action_issue_number: `Issue #${number}`,
      action_issue_pending: 'Issuing',
      action_update_number: 'Update',
      action_save_correction: 'Save correction',
      card_number_label: 'Card number',
      card_number_placeholder: `Auto ${number}`,
      issue_number_help: `Assign card #${number}.`,
      change_number_form_label: 'Change sailing card number',
      change_number_help: `Correct current card #${number}.`,
      error_card_number_duplicate: 'That card number is already in use.',
      error_card_number_invalid: 'Enter a positive card number.',
      error_missing_onboarding_agreement:
        'Missing onboarding agreement acceptance.',
      error_mit_recreation_required:
        'Verify MIT Recreation before issuing Normal.',
      error_no_current_card: 'No current card.',
      error_not_found: 'User was not found.',
      error_payment_required: 'Enter a note before issuing without payment.',
      error_same_card_number: 'Enter a different card number.',
      issue_form_label: 'Issue sailing card',
      card_type_normal: 'Normal',
      card_type_racing: 'Pavilion racing',
      card_type_team_racing: 'Thursday team racing',
      history_empty: 'No previous cards.',
      history_heading: 'Card history',
      history_row_changed: `Changed card #${fromNumber} to #${toNumber} for ${year}`,
      history_row_expired: `Expired card #${number} for ${year}`,
      history_row_issued: `Issued card #${number} for ${year}`,
      history_row_meta: date,
      history_row_meta_actor: `${date} by ${actor}`,
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
    expect(screen.getByLabelText('Card number')).toHaveValue(60);
    expect(screen.getByRole('button', { name: 'Issue #60' })).toBeVisible();
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

    await user.clear(screen.getByLabelText('Card number'));
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

  it('prefills current number when changing an issued card', () => {
    render(
      <AdminSailingCardChangeNumberForm
        action={vi.fn()}
        currentCardNumber={61}
        locale="en"
        userId="user-1"
      />
    );

    expect(
      screen.getByRole('form', { name: 'Change sailing card number' })
    ).toBeVisible();
    expect(screen.getByLabelText('Card number')).toBeRequired();
    expect(screen.getByLabelText('Card number')).toHaveValue(61);
    expect(
      screen.getByRole('button', { name: 'Save correction' })
    ).toBeVisible();
  });

  it('renders same-number correction errors', () => {
    actionStateMock.state = {
      fieldErrors: {},
      formError: 'same_card_number',
      status: 'error',
    };

    render(
      <AdminSailingCardChangeNumberForm
        action={vi.fn()}
        currentCardNumber={61}
        locale="en"
        userId="user-1"
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a different card number.'
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
            action: 'issued',
            actorName: 'Dock Master',
            fromNumber: null,
            fromYear: null,
            id: 'audit-1',
            toNumber: 42,
            toYear: 2027,
          },
        ]}
      />
    );

    expect(screen.getByText('Issued card #42 for 2027')).toBeInTheDocument();
    expect(screen.getByText(/Dock Master/u)).toBeInTheDocument();
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
