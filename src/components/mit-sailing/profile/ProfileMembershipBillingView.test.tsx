import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { SailingCardType } from '@/generated/prisma/enums';
import messages from '@/locales/en.json';
import { ProfileMembershipBillingView } from './ProfileMembershipBillingView';

const t = createTranslator({
  locale: 'en',
  messages,
  namespace: 'UserProfilePage',
});

describe('ProfileMembershipBillingView', () => {
  it('shows paid membership status and Stripe-hosted receipt link', () => {
    render(
      <ProfileMembershipBillingView
        accessThroughLabel="Jul 15, 2026"
        amountCents={12_000}
        cardType={SailingCardType.racing}
        kind="active_paid"
        locale="en"
        receiptUrl="https://pay.stripe.com/receipts/test"
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

    expect(screen.getByRole('link', { name: 'View payments' })).toHaveAttribute(
      'href',
      '/profile/payments'
    );

    const receiptLink = screen.getByRole('link', { name: 'Receipt' });
    expect(receiptLink).toHaveAttribute(
      'href',
      'https://pay.stripe.com/receipts/test'
    );
    expect(receiptLink).toHaveAttribute('target', '_blank');
    expect(receiptLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('hides unsafe receipt links when unavailable', () => {
    render(
      <ProfileMembershipBillingView
        accessThroughLabel={null}
        amountCents={null}
        cardType={null}
        kind="no_paid_membership"
        locale="en"
        receiptUrl="https://stripe.example/receipts/test"
        t={t}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'No paid membership' })
    ).toBeVisible();
    expect(screen.getAllByText('Not set')).toHaveLength(3);
    expect(screen.queryByRole('link', { name: 'Receipt' })).toBeNull();
    expect(screen.getByRole('link', { name: 'View payments' })).toHaveAttribute(
      'href',
      '/profile/payments'
    );
  });
});
