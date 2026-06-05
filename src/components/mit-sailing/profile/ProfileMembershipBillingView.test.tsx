import { render, screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { SailingCardType } from '@/generated/prisma/enums';
import messages from '@/locales/en.json';
import { ProfileMembershipBillingView } from './ProfileMembershipBillingView';

vi.mock(
  '@/libs/mit-sailing/membershipBilling/membershipBillingPortalActions',
  () => ({
    openMembershipBillingPortalAction: vi.fn(async () => {}),
  })
);

vi.mock(
  '@/libs/mit-sailing/membershipBilling/membershipCancellationActions',
  () => ({
    turnOffMembershipAutoRenewFormAction: vi.fn(async () => {}),
  })
);

const t = createTranslator({
  locale: 'en',
  messages,
  namespace: 'UserProfilePage',
});

describe('ProfileMembershipBillingView', () => {
  it('shows paid membership actions and a Stripe-hosted receipt link', () => {
    render(
      <ProfileMembershipBillingView
        accessThroughLabel="Jul 15, 2026"
        amountCents={12_000}
        canOpenBillingPortal
        canTurnOffAutoRenew
        cardType={SailingCardType.racing}
        kind="active_paid"
        locale="en"
        receiptUrl="https://pay.stripe.com/receipts/test"
        subscriptionId="subscription-1"
        t={t}
      />
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Membership' })
    ).toBeVisible();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Paid membership is active',
      })
    ).toBeVisible();
    expect(screen.getByText('Pavilion racing')).toBeVisible();
    expect(screen.getByText('Jul 15, 2026')).toBeVisible();
    expect(screen.getByText('$120.00')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Update payment method' })
    ).toBeVisible();

    const autoRenewForm = screen
      .getByRole('heading', { name: 'Auto-renew' })
      .closest('form');
    if (!(autoRenewForm instanceof HTMLElement)) {
      throw new Error('Expected auto-renew form to render.');
    }
    expect(
      autoRenewForm.querySelector('input[name="subscriptionId"]')
    ).toHaveAttribute('value', 'subscription-1');
    expect(within(autoRenewForm).getByLabelText('Cost')).toHaveAttribute(
      'value',
      'cost'
    );
    expect(
      within(autoRenewForm).getByLabelText('Optional note')
    ).toHaveAttribute('name', 'note');

    const paymentsLink = screen.getByRole('link', { name: 'View payments' });
    expect(paymentsLink).toHaveAttribute('href', '/profile/payments');

    const receiptLink = screen.getByRole('link', { name: 'Receipt' });
    expect(receiptLink).toHaveAttribute(
      'href',
      'https://pay.stripe.com/receipts/test'
    );
    expect(receiptLink).toHaveAttribute('target', '_blank');
    expect(receiptLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('hides paid billing actions and unsafe receipt links when unavailable', () => {
    render(
      <ProfileMembershipBillingView
        accessThroughLabel={null}
        amountCents={null}
        canOpenBillingPortal={false}
        canTurnOffAutoRenew={false}
        cardType={null}
        kind="no_paid_membership"
        locale="en"
        receiptUrl="https://stripe.example/receipts/test"
        subscriptionId={null}
        t={t}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'No paid membership' })
    ).toBeVisible();
    expect(screen.getAllByText('Not set')).toHaveLength(3);
    expect(
      screen.queryByRole('button', { name: 'Update payment method' })
    ).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Auto-renew' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Receipt' })).toBeNull();
    expect(screen.getByRole('link', { name: 'View payments' })).toHaveAttribute(
      'href',
      '/profile/payments'
    );
  });

  it('does not render auto-renew cancellation without a subscription id', () => {
    render(
      <ProfileMembershipBillingView
        accessThroughLabel="Jul 15, 2026"
        amountCents={12_000}
        canOpenBillingPortal={false}
        canTurnOffAutoRenew
        cardType={SailingCardType.racing}
        kind="active_paid"
        locale="en"
        receiptUrl={null}
        subscriptionId={null}
        t={t}
      />
    );

    expect(screen.queryByRole('heading', { name: 'Auto-renew' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Turn off auto-renew' })
    ).toBeNull();
  });
});
