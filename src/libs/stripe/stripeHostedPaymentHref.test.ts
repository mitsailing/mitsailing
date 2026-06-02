import { describe, expect, it } from 'vitest';
import { safeStripeHostedPaymentHref } from './stripeHostedPaymentHref';

describe('safeStripeHostedPaymentHref', () => {
  it('accepts Stripe hosted payment URLs', () => {
    expect(
      safeStripeHostedPaymentHref('https://checkout.stripe.com/c/pay/cs_test')
    ).toBe('https://checkout.stripe.com/c/pay/cs_test');
    expect(
      safeStripeHostedPaymentHref('https://pay.stripe.com/receipts/test')
    ).toBe('https://pay.stripe.com/receipts/test');
    expect(
      safeStripeHostedPaymentHref('https://pay.stripe.com/invoice/test')
    ).toBe('https://pay.stripe.com/invoice/test');
  });

  it('rejects unsafe or non-Stripe URLs', () => {
    expect(
      safeStripeHostedPaymentHref(
        ['http', '://checkout.stripe.com/test'].join('')
      )
    ).toBe(null);
    expect(safeStripeHostedPaymentHref('https://stripe.example/test')).toBe(
      null
    );
    expect(
      safeStripeHostedPaymentHref(
        'https://user:pass@checkout.stripe.com/c/pay/cs_test'
      )
    ).toBe(null);
    expect(
      safeStripeHostedPaymentHref(['java', 'script:alert(1)'].join(''))
    ).toBe(null);
    expect(safeStripeHostedPaymentHref('/profile/payments')).toBe(null);
  });
});
