import { describe, expect, it } from 'vitest';
import { PaymentPurpose } from '@/generated/prisma/enums';
import { paymentPurposeDatabaseValue } from '@/libs/mit-sailing/payments/paymentPurposeDatabaseValue';

describe('paymentPurposeDatabaseValue', () => {
  it('maps prisma event_payment to postgres event label', () => {
    expect(paymentPurposeDatabaseValue(PaymentPurpose.event_payment)).toBe(
      'event'
    );
  });

  it('maps membership to the same postgres label', () => {
    expect(paymentPurposeDatabaseValue(PaymentPurpose.membership)).toBe(
      'membership'
    );
  });
});
