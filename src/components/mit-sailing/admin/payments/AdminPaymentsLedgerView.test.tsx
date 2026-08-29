import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PaymentStatus } from '@/generated/prisma/enums';
import messages from '@/locales/en.json';
import { AdminPaymentsLedgerView } from './AdminPaymentsLedgerView';

vi.mock('@/libs/I18nNavigation', () => ({
  Link: (props: React.ComponentProps<'a'>) => (
    <a className={props.className} href={props.href}>
      {props.children}
    </a>
  ),
}));

const t = createTranslator({
  locale: 'en',
  messages,
  namespace: 'AdminPayments',
});

const baseViewProps = {
  dashboardBaseUrl: 'https://dashboard.stripe.com/test',
  filters: {},
  locale: 'en',
  stripeConfigured: false,
  t,
  webhookConfigured: false,
} as const;

const baseLedgerRow = {
  amountCents: 5000,
  amountPaidCents: null,
  createdAt: new Date('2026-05-21T16:00:00.000Z'),
  event: null,
  id: 'payment-1',
  legacyCategory: null,
  legacyDescription: null,
  legacySourceId: null,
  legacySourceTable: null,
  payerEmail: null,
  payerName: null,
  receiptUrl: null,
  refundedAmountCents: null,
  status: PaymentStatus.paid,
  stripeDiscountMetadata: null,
  stripeCheckoutSessionId: null,
  stripePaymentIntentId: null,
  user: null,
} as const;

describe('AdminPaymentsLedgerView', () => {
  it('renders legacy source evidence for imported event payments', () => {
    render(
      <AdminPaymentsLedgerView
        {...baseViewProps}
        data={{
          latestWebhook: null,
          rows: [
            {
              ...baseLedgerRow,
              legacyCategory: 'regatta_registration',
              legacyDescription: 'CROTR registration',
              legacySourceId: 'REG-1001',
              legacySourceTable: 'legacy.payments',
              payerEmail: 'sailor@example.com',
              payerName: 'Sailor One',
              status: PaymentStatus.needs_review,
            },
          ],
        }}
        filters={{ status: PaymentStatus.needs_review }}
      />
    );

    expect(
      screen.getByText(
        'Legacy source: legacy.payments REG-1001 · regatta_registration'
      )
    ).toBeVisible();
  });

  it('renders paid amount and coupon metadata for discounted Stripe payments', () => {
    render(
      <AdminPaymentsLedgerView
        {...baseViewProps}
        data={{
          latestWebhook: null,
          rows: [
            {
              ...baseLedgerRow,
              amountCents: 5000,
              amountPaidCents: 0,
              stripeDiscountMetadata: {
                amountDiscountCents: 5000,
                discounts: [{ promotionCode: 'VOLUNTEER' }],
              },
            },
          ],
        }}
        filters={{}}
      />
    );

    expect(screen.getByText('$0.00 of $50.00')).toBeVisible();
    expect(screen.getByText('Discount: VOLUNTEER')).toBeVisible();
  });

  it('renders empty state when no payments match filters', () => {
    render(
      <AdminPaymentsLedgerView
        {...baseViewProps}
        data={{ latestWebhook: null, rows: [] }}
        filters={{}}
      />
    );

    expect(screen.getByText('No payments match those filters.')).toBeVisible();
  });

  it('renders Stripe dashboard links for payments with a payment intent id', () => {
    render(
      <AdminPaymentsLedgerView
        {...baseViewProps}
        data={{
          latestWebhook: null,
          rows: [
            {
              ...baseLedgerRow,
              stripePaymentIntentId: 'pi_test_abc',
              user: {
                email: 'sailor@example.com',
                id: 'user-sailor',
                name: 'Sailor One',
              },
            },
          ],
        }}
        filters={{}}
      />
    );

    const paymentLink = screen.getByRole('link', { name: 'Payment' });
    expect(paymentLink).toHaveAttribute(
      'href',
      'https://dashboard.stripe.com/test/payments/pi_test_abc'
    );
    expect(paymentLink).toHaveAttribute('target', '_blank');
  });

  it('renders Stripe checkout session link for checkout-created payments', () => {
    render(
      <AdminPaymentsLedgerView
        {...baseViewProps}
        data={{
          latestWebhook: null,
          rows: [
            {
              ...baseLedgerRow,
              status: PaymentStatus.checkout_created,
              stripeCheckoutSessionId: 'cs_test_xyz',
            },
          ],
        }}
        filters={{}}
      />
    );

    const checkoutLink = screen.getByRole('link', { name: 'Checkout' });
    expect(checkoutLink).toHaveAttribute(
      'href',
      'https://dashboard.stripe.com/test/checkout/sessions/cs_test_xyz'
    );
  });

  it('shows both payment and checkout links when both stripe ids are present', () => {
    render(
      <AdminPaymentsLedgerView
        {...baseViewProps}
        data={{
          latestWebhook: null,
          rows: [
            {
              ...baseLedgerRow,
              stripeCheckoutSessionId: 'cs_test_xyz',
              stripePaymentIntentId: 'pi_test_abc',
            },
          ],
        }}
        filters={{}}
      />
    );

    expect(screen.getByRole('link', { name: 'Payment' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Checkout' })).toBeInTheDocument();
  });

  it('links event payment title to the event page', () => {
    render(
      <AdminPaymentsLedgerView
        {...baseViewProps}
        data={{
          latestWebhook: null,
          rows: [
            {
              ...baseLedgerRow,
              event: { name: 'Spring Series', slug: 'spring-series' },
            },
          ],
        }}
        filters={{}}
      />
    );

    expect(screen.getByRole('link', { name: 'Spring Series' })).toHaveAttribute(
      'href',
      '/events/spring-series'
    );
  });

  it('renders payer info from user when user is linked to a payment', () => {
    render(
      <AdminPaymentsLedgerView
        {...baseViewProps}
        data={{
          latestWebhook: null,
          rows: [
            {
              ...baseLedgerRow,
              user: {
                email: 'grace@example.com',
                id: 'user-grace',
                name: 'Grace Hopper',
              },
            },
          ],
        }}
        filters={{}}
      />
    );

    const userLink = screen.getByRole('link', { name: 'Grace Hopper' });
    expect(userLink).toHaveAttribute('href', '/admin/users/user-grace');
    expect(screen.getByText(/grace@example.com/)).toBeVisible();
  });

  it('renders payer info from legacy fields when no user is linked', () => {
    render(
      <AdminPaymentsLedgerView
        {...baseViewProps}
        data={{
          latestWebhook: null,
          rows: [
            {
              ...baseLedgerRow,
              payerEmail: 'legacy@example.com',
              payerName: 'Legacy Payer',
            },
          ],
        }}
        filters={{}}
      />
    );

    expect(screen.getByText(/Legacy Payer/)).toBeVisible();
    expect(screen.getByText(/legacy@example.com/)).toBeVisible();
  });

  it('shows needs_review status label in the payment list', () => {
    render(
      <AdminPaymentsLedgerView
        {...baseViewProps}
        data={{
          latestWebhook: null,
          rows: [
            {
              ...baseLedgerRow,
              status: PaymentStatus.needs_review,
            },
          ],
        }}
        filters={{ status: PaymentStatus.needs_review }}
      />
    );

    expect(screen.getAllByText('Needs review')).toHaveLength(2);
  });

  it('shows Stripe configured status in the health summary', () => {
    render(
      <AdminPaymentsLedgerView
        {...baseViewProps}
        data={{ latestWebhook: null, rows: [] }}
        filters={{}}
        stripeConfigured
      />
    );

    expect(screen.getByText('Stripe API')).toBeVisible();
    expect(screen.getAllByText('Configured')).toHaveLength(1);
  });

  it('shows not-configured status for missing stripe and webhook setup', () => {
    render(
      <AdminPaymentsLedgerView
        {...baseViewProps}
        data={{ latestWebhook: null, rows: [] }}
        filters={{}}
        stripeConfigured={false}
        webhookConfigured={false}
      />
    );

    expect(screen.getAllByText('Not configured')).toHaveLength(2);
  });

  it('shows latest webhook event type and date in the health summary', () => {
    render(
      <AdminPaymentsLedgerView
        {...baseViewProps}
        data={{
          latestWebhook: {
            eventType: 'payment_intent.succeeded',
            processedAt: null,
            stripeCreatedAt: new Date('2026-05-21T16:00:00.000Z'),
          },
          rows: [],
        }}
        filters={{}}
      />
    );

    expect(screen.getByText(/payment_intent\.succeeded/)).toBeVisible();
  });
});
