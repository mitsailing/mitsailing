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

describe('AdminPaymentsLedgerView', () => {
  it('renders legacy source evidence for imported payments', () => {
    render(
      <AdminPaymentsLedgerView
        dashboardBaseUrl="https://dashboard.stripe.com/test"
        data={{
          latestWebhook: null,
          rows: [
            {
              amountCents: 5000,
              createdAt: new Date('2026-05-21T16:00:00.000Z'),
              event: null,
              id: 'payment-1',
              legacyCategory: 'boat_deposit',
              legacyDescription: 'CROTR07 Damage Deposit',
              legacySourceId: 'BD-1001',
              legacySourceTable: 'legacy.payments',
              payerEmail: 'sailor@example.com',
              payerName: 'Sailor One',
              receiptUrl: null,
              status: PaymentStatus.needs_review,
              stripeCheckoutSessionId: null,
              stripePaymentIntentId: null,
              user: null,
            },
          ],
        }}
        filters={{ status: PaymentStatus.needs_review }}
        locale="en"
        stripeConfigured={false}
        t={t}
        webhookConfigured={false}
      />
    );

    expect(
      screen.getByText('Legacy source: legacy.payments BD-1001 · boat_deposit')
    ).toBeVisible();
  });
});
