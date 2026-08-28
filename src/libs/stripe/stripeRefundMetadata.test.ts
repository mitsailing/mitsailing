import { describe, expect, it } from 'vitest';
import { PaymentStatus } from '@/generated/prisma/enums';
import {
  paymentDisputeUpdateFromStripe,
  paymentRefundUpdateFromStripe,
  stripeCumulativeRefundedAmountCents,
} from '@/libs/stripe/stripeRefundMetadata';

describe('stripeCumulativeRefundedAmountCents', () => {
  it('reads cumulative amount_refunded from charge objects', () => {
    expect(
      stripeCumulativeRefundedAmountCents({ amount_refunded: 2500 }, null)
    ).toBe(2500);
  });

  it('adds incremental refund amounts from refund objects', () => {
    expect(
      stripeCumulativeRefundedAmountCents(
        { amount: 1500, object: 'refund' },
        1000
      )
    ).toBe(2500);
  });

  it('does not double-count refund.updated for the same refund id', () => {
    expect(
      stripeCumulativeRefundedAmountCents(
        { amount: 1500, id: 're_123', object: 'refund' },
        2500,
        're_123'
      )
    ).toBe(2500);
  });
});

describe('paymentRefundUpdateFromStripe', () => {
  const payment = {
    amountCents: 7000,
    amountPaidCents: 7000,
  };

  it('keeps paid status for partial refunds', () => {
    expect(
      paymentRefundUpdateFromStripe({
        existingRefundedAmountCents: null,
        object: { amount_refunded: 2000 },
        payment,
      })
    ).toEqual({
      refundedAmountCents: 2000,
      status: PaymentStatus.paid,
    });
  });

  it('marks full refunds refunded and clears active checkout key', () => {
    expect(
      paymentRefundUpdateFromStripe({
        clearActiveCheckoutKeyOnFullRefund: true,
        existingRefundedAmountCents: 2000,
        object: { amount: 5000, object: 'refund' },
        payment,
      })
    ).toEqual({
      activeCheckoutKey: null,
      refundedAmountCents: 7000,
      status: PaymentStatus.refunded,
    });
  });

  it('ignores duplicate refund.updated events for the same refund id', () => {
    expect(
      paymentRefundUpdateFromStripe({
        existingRefundedAmountCents: 2500,
        existingStripeRefundId: 're_123',
        object: { amount: 1500, id: 're_123', object: 'refund' },
        payment,
      })
    ).toEqual({
      refundedAmountCents: 2500,
      status: PaymentStatus.paid,
      stripeRefundId: 're_123',
    });
  });
});

describe('paymentDisputeUpdateFromStripe', () => {
  it('marks disputed and clears active checkout key when requested', () => {
    expect(
      paymentDisputeUpdateFromStripe({
        clearActiveCheckoutKey: true,
        disputeId: 'dp_test',
      })
    ).toEqual({
      activeCheckoutKey: null,
      status: PaymentStatus.disputed,
      stripeDisputeId: 'dp_test',
    });
  });
});
