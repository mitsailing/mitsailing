import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import {
  PaymentSource,
  PaymentStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import messages from '@/locales/en.json';
import { ProfilePaymentsView } from './ProfilePaymentsView';

const t = createTranslator({
  locale: 'en',
  messages,
  namespace: 'UserProfilePage',
});

const basePayment = {
  amountCents: 5000,
  cardType: null,
  cardYear: null,
  createdAt: new Date('2026-05-19T16:00:00.000Z'),
  event: null,
  id: 'payment-1',
  legacyDescription: null,
  purpose: 'event' as const,
  receiptUrl: null,
  source: PaymentSource.stripe,
  status: PaymentStatus.paid,
};

describe('ProfilePaymentsView', () => {
  it('shows legacy paid membership without a Stripe receipt link', () => {
    render(
      <ProfilePaymentsView
        locale="en"
        payments={[
          {
            amountCents: 12_000,
            cardType: SailingCardType.racing,
            cardYear: 2027,
            createdAt: new Date('2026-05-19T16:00:00.000Z'),
            event: null,
            id: 'payment-1',
            legacyDescription: null,
            purpose: 'membership',
            receiptUrl: null,
            source: PaymentSource.legacy,
            status: PaymentStatus.paid,
          },
        ]}
        t={t}
      />
    );

    expect(screen.getByText('2027 Pavilion racing sailing card')).toBeVisible();
    expect(screen.getByText('No Stripe receipt')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Receipt' })).toBeNull();
  });

  it('shows an empty state when there are no payments', () => {
    render(<ProfilePaymentsView locale="en" payments={[]} t={t} />);

    expect(screen.getByText('No payments yet.')).toBeVisible();
  });

  it('shows a receipt link for a paid Stripe event payment', () => {
    render(
      <ProfilePaymentsView
        locale="en"
        payments={[
          {
            ...basePayment,
            event: { name: 'Firefly Clinic', slug: 'firefly-clinic' },
            receiptUrl: 'https://pay.stripe.com/receipts/test',
            status: PaymentStatus.paid,
          },
        ]}
        t={t}
      />
    );

    const receiptLink = screen.getByRole('link', { name: 'Receipt' });
    expect(receiptLink).toHaveAttribute(
      'href',
      'https://pay.stripe.com/receipts/test'
    );
    expect(receiptLink).toHaveAttribute('target', '_blank');
  });

  it('links the payment title to the event page', () => {
    render(
      <ProfilePaymentsView
        locale="en"
        payments={[
          {
            ...basePayment,
            event: { name: 'Spring Series', slug: 'spring-series' },
          },
        ]}
        t={t}
      />
    );

    expect(screen.getByRole('link', { name: 'Spring Series' })).toHaveAttribute(
      'href',
      '/events/spring-series'
    );
  });

  it('shows membership title with Normal card type', () => {
    render(
      <ProfilePaymentsView
        locale="en"
        payments={[
          {
            ...basePayment,
            cardType: SailingCardType.normal,
            cardYear: 2026,
            purpose: 'membership',
            source: PaymentSource.stripe,
            status: PaymentStatus.paid,
          },
        ]}
        t={t}
      />
    );

    expect(screen.getByText('2026 Normal sailing card')).toBeVisible();
  });

  it('shows membership title with Thursday team racing card type', () => {
    render(
      <ProfilePaymentsView
        locale="en"
        payments={[
          {
            ...basePayment,
            cardType: SailingCardType.team_racing,
            cardYear: 2026,
            purpose: 'membership',
            source: PaymentSource.stripe,
            status: PaymentStatus.paid,
          },
        ]}
        t={t}
      />
    );

    expect(
      screen.getByText('2026 Thursday team racing sailing card')
    ).toBeVisible();
  });

  it('uses legacy description as payment title when there is no event', () => {
    render(
      <ProfilePaymentsView
        locale="en"
        payments={[
          {
            ...basePayment,
            legacyDescription: 'Old boat deposit payment',
            source: PaymentSource.legacy,
            status: PaymentStatus.paid,
          },
        ]}
        t={t}
      />
    );

    expect(screen.getByText('Old boat deposit payment')).toBeVisible();
  });

  it('falls back to generic Payment title when there is no event or description', () => {
    render(
      <ProfilePaymentsView
        locale="en"
        payments={[
          {
            ...basePayment,
            source: PaymentSource.legacy,
            status: PaymentStatus.needs_review,
          },
        ]}
        t={t}
      />
    );

    expect(screen.getByRole('rowheader', { name: 'Payment' })).toBeVisible();
  });

  it('shows needs_review status label', () => {
    render(
      <ProfilePaymentsView
        locale="en"
        payments={[
          {
            ...basePayment,
            status: PaymentStatus.needs_review,
          },
        ]}
        t={t}
      />
    );

    expect(screen.getByText('Needs review')).toBeVisible();
  });

  it('shows handled status label and hides receipt link', () => {
    render(
      <ProfilePaymentsView
        locale="en"
        payments={[
          {
            ...basePayment,
            receiptUrl: 'https://pay.stripe.com/receipts/handled',
            status: PaymentStatus.handled,
          },
        ]}
        t={t}
      />
    );

    expect(screen.getByText('Handled by MIT Sailing')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Receipt' })).toBeNull();
    expect(screen.getByText('None')).toBeVisible();
  });

  it('shows refunded status label', () => {
    render(
      <ProfilePaymentsView
        locale="en"
        payments={[
          {
            ...basePayment,
            status: PaymentStatus.refunded,
          },
        ]}
        t={t}
      />
    );

    expect(screen.getByText('Refunded')).toBeVisible();
  });

  it('shows disputed status label', () => {
    render(
      <ProfilePaymentsView
        locale="en"
        payments={[
          {
            ...basePayment,
            status: PaymentStatus.disputed,
          },
        ]}
        t={t}
      />
    );

    expect(screen.getByText('Disputed')).toBeVisible();
  });

  it('shows cancelled status label', () => {
    render(
      <ProfilePaymentsView
        locale="en"
        payments={[
          {
            ...basePayment,
            status: PaymentStatus.cancelled,
          },
        ]}
        t={t}
      />
    );

    expect(screen.getByText('Cancelled')).toBeVisible();
  });

  it('shows Payment due label for non-terminal statuses', () => {
    render(
      <ProfilePaymentsView
        locale="en"
        payments={[
          {
            ...basePayment,
            status: PaymentStatus.pending,
          },
        ]}
        t={t}
      />
    );

    expect(screen.getByText('Payment due')).toBeVisible();
  });

  it('shows admin_override source label', () => {
    render(
      <ProfilePaymentsView
        locale="en"
        payments={[
          {
            ...basePayment,
            source: PaymentSource.admin_override,
            status: PaymentStatus.paid,
          },
        ]}
        t={t}
      />
    );

    expect(screen.getByText('Handled by MIT Sailing')).toBeVisible();
  });

  it('shows stripe source label', () => {
    render(
      <ProfilePaymentsView
        locale="en"
        payments={[
          {
            ...basePayment,
            source: PaymentSource.stripe,
            status: PaymentStatus.paid,
          },
        ]}
        t={t}
      />
    );

    expect(screen.getByText('Stripe')).toBeVisible();
  });

  it('shows legacy source label', () => {
    render(
      <ProfilePaymentsView
        locale="en"
        payments={[
          {
            ...basePayment,
            source: PaymentSource.legacy,
            status: PaymentStatus.paid,
          },
        ]}
        t={t}
      />
    );

    expect(screen.getByText('Old payment system')).toBeVisible();
  });

  it('shows None receipt label for non-legacy unpaid payments without receipt', () => {
    render(
      <ProfilePaymentsView
        locale="en"
        payments={[
          {
            ...basePayment,
            source: PaymentSource.stripe,
            status: PaymentStatus.pending,
          },
        ]}
        t={t}
      />
    );

    expect(screen.getByText('None')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Receipt' })).toBeNull();
  });
});
