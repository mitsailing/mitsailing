import { describe, expect, it } from 'vitest';
import { PaymentStatus } from '@/generated/prisma/enums';
import {
  parseStripeRefundLedger,
  paymentDisputeUpdateFromStripe,
  paymentRefundUpdateFromStripe,
  stripeCumulativeRefundedAmountCents,
} from '@/libs/stripe/stripeRefundMetadata';

describe('parseStripeRefundLedger', () => {
  it('parses serialized refund id and amount pairs', () => {
    expect(parseStripeRefundLedger('re_1:1000,re_2:1500')).toEqual([
      { amountCents: 1000, id: 're_1' },
      { amountCents: 1500, id: 're_2' },
    ]);
  });

  it('supports legacy single refund ids without amounts', () => {
    expect(parseStripeRefundLedger('re_123')).toEqual([
      { amountCents: 0, id: 're_123' },
    ]);
  });
});

describe('stripeCumulativeRefundedAmountCents', () => {
  it('reads cumulative amount_refunded from charge objects', () => {
    expect(
      stripeCumulativeRefundedAmountCents({ amount_refunded: 2500 }, null)
    ).toEqual({
      amount: 2500,
      ledger: [],
    });
  });

  it('reads cumulative amount_refunded from expanded charge objects', () => {
    expect(
      stripeCumulativeRefundedAmountCents(
        {
          amount: 1500,
          charge: { amount_refunded: 4000 },
          id: 're_2',
          object: 'refund',
        },
        2500,
        [{ amountCents: 1000, id: 're_1' }]
      )
    ).toEqual({
      amount: 4000,
      ledger: [
        { amountCents: 1000, id: 're_1' },
        { amountCents: 1500, id: 're_2' },
      ],
    });
  });

  it('adds incremental refund amounts from refund objects', () => {
    expect(
      stripeCumulativeRefundedAmountCents(
        { amount: 1500, id: 're_2', object: 'refund' },
        1000,
        [{ amountCents: 1000, id: 're_1' }]
      )
    ).toEqual({
      amount: 2500,
      ledger: [
        { amountCents: 1000, id: 're_1' },
        { amountCents: 1500, id: 're_2' },
      ],
    });
  });

  it('does not double-count when the same refund id is seen again', () => {
    const ledger = [
      { amountCents: 1000, id: 're_1' },
      { amountCents: 1500, id: 're_2' },
    ];
    expect(
      stripeCumulativeRefundedAmountCents(
        { amount: 1000, id: 're_1', object: 'refund' },
        2500,
        ledger
      )
    ).toEqual({
      amount: 2500,
      ledger,
    });
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
        existingRefundLedger: [{ amountCents: 2000, id: 're_prior' }],
        object: { amount: 5000, id: 're_full', object: 'refund' },
        payment,
      })
    ).toEqual({
      activeCheckoutKey: null,
      refundedAmountCents: 7000,
      status: PaymentStatus.refunded,
      stripeRefundId: 're_prior:2000,re_full:5000',
    });
  });

  it('tracks re_1, re_2, then re_1 again without increasing refundedAmountCents', () => {
    let refundedAmountCents: number | null = null;
    let stripeRefundId: string | null = null;

    expect(
      paymentRefundUpdateFromStripe({
        existingRefundedAmountCents: refundedAmountCents,
        object: { amount: 1000, id: 're_1', object: 'refund' },
        payment,
      })
    ).toEqual({
      refundedAmountCents: 1000,
      status: PaymentStatus.paid,
      stripeRefundId: 're_1:1000',
    });
    refundedAmountCents = 1000;
    stripeRefundId = 're_1:1000';

    expect(
      paymentRefundUpdateFromStripe({
        existingRefundedAmountCents: refundedAmountCents,
        existingRefundLedger: parseStripeRefundLedger(stripeRefundId),
        object: { amount: 1500, id: 're_2', object: 'refund' },
        payment,
      })
    ).toEqual({
      refundedAmountCents: 2500,
      status: PaymentStatus.paid,
      stripeRefundId: 're_1:1000,re_2:1500',
    });
    refundedAmountCents = 2500;
    stripeRefundId = 're_1:1000,re_2:1500';

    expect(
      paymentRefundUpdateFromStripe({
        existingRefundedAmountCents: refundedAmountCents,
        existingRefundLedger: parseStripeRefundLedger(stripeRefundId),
        object: { amount: 1000, id: 're_1', object: 'refund' },
        payment,
      })
    ).toEqual({
      refundedAmountCents: 2500,
      status: PaymentStatus.paid,
      stripeRefundId: 're_1:1000,re_2:1500',
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
