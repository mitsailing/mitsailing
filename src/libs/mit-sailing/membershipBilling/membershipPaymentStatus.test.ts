import { describe, expect, it } from 'vitest';
import { membershipPaymentAccessStatus } from '@/libs/mit-sailing/membershipBilling/membershipPaymentStatus';
import type { MembershipPaymentAccessRecord } from '@/libs/mit-sailing/membershipBilling/membershipPaymentStatus';

describe('membershipPaymentAccessStatus', () => {
  it('treats a paid legacy record as current paid access without a receipt', () => {
    const record = {
      cardType: 'racing',
      cardYear: 2027,
      source: 'legacy',
      status: 'paid',
      stripeReceiptUrl: null,
    } satisfies MembershipPaymentAccessRecord;

    expect(membershipPaymentAccessStatus({ cardYear: 2027, record })).toEqual({
      access: 'paid',
      labelKey: 'membership_status_paid_legacy',
      receiptHref: null,
      setupAutoRenewPrompt: true,
    });
  });

  it('does not grant access for ambiguous legacy matches', () => {
    const record = {
      cardType: 'racing',
      cardYear: 2027,
      source: 'legacy',
      status: 'needs_review',
      stripeReceiptUrl: null,
    } satisfies MembershipPaymentAccessRecord;

    expect(
      membershipPaymentAccessStatus({ cardYear: 2027, record })
    ).toMatchObject({
      access: 'blocked',
      blocker: 'legacy_review_required',
    });
  });

  it('treats a handled admin override as paid access without a receipt', () => {
    const record = {
      cardType: 'team_racing',
      cardYear: 2027,
      source: 'admin_override',
      status: 'handled',
      stripeReceiptUrl: null,
    } satisfies MembershipPaymentAccessRecord;

    expect(membershipPaymentAccessStatus({ cardYear: 2027, record })).toEqual({
      access: 'paid',
      labelKey: 'membership_status_paid_admin_override',
      receiptHref: null,
      setupAutoRenewPrompt: false,
    });
  });
});
