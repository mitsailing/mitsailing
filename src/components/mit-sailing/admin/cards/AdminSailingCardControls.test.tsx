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
  AdminSailingCardPrintActions,
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

function numberValue(props: {
  readonly field: string;
  readonly values: Record<string, unknown> | undefined;
}) {
  const value = props.values?.[props.field];
  return typeof value === 'number' ? value : '';
}

function stringValue(props: {
  readonly field: string;
  readonly values: Record<string, unknown> | undefined;
}) {
  const value = props.values?.[props.field];
  return typeof value === 'string' ? value : '';
}

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const number = numberValue({ field: 'number', values });
    const year = numberValue({ field: 'year', values });
    const fromNumber = numberValue({ field: 'fromNumber', values });
    const toNumber = numberValue({ field: 'toNumber', values });
    const date = stringValue({ field: 'date', values });
    const actor = stringValue({ field: 'actor', values });
    const messages: Record<string, string> = {
      action_expire: 'Expire',
      action_issue: 'Assign card',
      action_issue_number: `Issue #${number}`,
      action_issue_pending: 'Issuing',
      action_print_card: 'Print card',
      action_update_number: 'Update',
      action_save_correction: 'Save number',
      card_number_label: 'Card number',
      card_number_placeholder: `Auto ${number}`,
      fitness_membership_verify_help:
        'Check after confirming this user has MIT Recreation membership.',
      fitness_membership_verify_label: 'MIT Recreation verified',
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
      error_payment_required:
        'Stripe payment or a promotion-code checkout is required before issuing this card.',
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
    expect(screen.getByRole('button', { name: 'Assign card' })).toBeVisible();
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

  it('renders payment-required notice for paid pending rows without payment', () => {
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

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Stripe payment or a promotion-code checkout is required before issuing this card.'
    );
    expect(screen.queryByLabelText('Payment bypass note')).toBeNull();
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
      'Stripe payment or a promotion-code checkout is required before issuing this card.'
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
    expect(screen.getByRole('button', { name: 'Save number' })).toBeVisible();
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

  it('renders payment-required notice for team racing cards without payment', () => {
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

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Stripe payment or a promotion-code checkout is required before issuing this card.'
    );
    expect(screen.queryByLabelText('Payment bypass note')).toBeNull();
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

  it('requires recreation verification when issuing a normal card that needs it', () => {
    render(
      <AdminSailingCardIssueForm
        action={vi.fn()}
        cardType={SailingCardType.normal}
        locale="en"
        needsRecreationVerification
        paymentAccess="none"
        suggestedCardNumber={60}
        userId="user-1"
      />
    );

    const verification = screen.getByLabelText('MIT Recreation verified');
    expect(verification).toHaveAttribute('name', 'gymMembershipVerified');
    expect(verification).toBeRequired();
    expect(
      screen.getByText(
        'Check after confirming this user has MIT Recreation membership.'
      )
    ).toBeVisible();
  });

  it('opens regular print directly to the inline PDF in a new tab', () => {
    render(<AdminSailingCardPrintActions userId="user/1" />);

    expect(screen.getByRole('link', { name: 'Print card' })).toHaveAttribute(
      'href',
      '/api/admin/users/user%2F1/sailing-card/pdf'
    );
    expect(screen.getByRole('link', { name: 'Print card' })).toHaveAttribute(
      'target',
      '_blank'
    );
    expect(screen.getByRole('link', { name: 'Print card' })).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    );
    expect(screen.queryByRole('link', { name: 'Quick print' })).toBeNull();
  });
});
