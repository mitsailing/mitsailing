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
});
