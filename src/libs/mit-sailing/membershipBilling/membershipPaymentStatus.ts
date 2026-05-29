export type MembershipPaymentSource = 'admin_override' | 'legacy' | 'stripe';

export type MembershipPaymentStatus =
  | 'cancelled'
  | 'disputed'
  | 'handled'
  | 'needs_review'
  | 'paid'
  | 'past_due'
  | 'pending'
  | 'refunded';

export type MembershipPaymentAccessRecord = {
  readonly cardType: 'racing' | 'team_racing';
  readonly cardYear: number;
  readonly source: MembershipPaymentSource;
  readonly status: MembershipPaymentStatus;
  readonly stripeReceiptUrl: string | null;
};

export type MembershipPaymentAccessStatus =
  | {
      readonly access: 'paid';
      readonly labelKey:
        | 'membership_status_paid_admin_override'
        | 'membership_status_paid_legacy'
        | 'membership_status_paid_stripe';
      readonly receiptHref: string | null;
      readonly setupAutoRenewPrompt: boolean;
    }
  | {
      readonly access: 'blocked';
      readonly blocker:
        | 'legacy_review_required'
        | 'payment_disputed'
        | 'payment_past_due'
        | 'payment_refunded';
    }
  | { readonly access: 'none' };

function membershipPaidLabelKey(
  source: MembershipPaymentSource
):
  | 'membership_status_paid_admin_override'
  | 'membership_status_paid_legacy'
  | 'membership_status_paid_stripe' {
  if (source === 'legacy') {
    return 'membership_status_paid_legacy';
  }
  if (source === 'admin_override') {
    return 'membership_status_paid_admin_override';
  }
  return 'membership_status_paid_stripe';
}

export function membershipPaymentAccessStatus(props: {
  readonly cardYear: number;
  readonly record: MembershipPaymentAccessRecord | null;
}): MembershipPaymentAccessStatus {
  if (props.record === null || props.record.cardYear !== props.cardYear) {
    return { access: 'none' };
  }

  if (props.record.status === 'needs_review') {
    return { access: 'blocked', blocker: 'legacy_review_required' };
  }

  if (props.record.status === 'disputed') {
    return { access: 'blocked', blocker: 'payment_disputed' };
  }

  if (props.record.status === 'past_due') {
    return { access: 'blocked', blocker: 'payment_past_due' };
  }

  if (props.record.status === 'refunded') {
    return { access: 'blocked', blocker: 'payment_refunded' };
  }

  if (props.record.status === 'paid' || props.record.status === 'handled') {
    return {
      access: 'paid',
      labelKey: membershipPaidLabelKey(props.record.source),
      receiptHref:
        props.record.source === 'stripe' ? props.record.stripeReceiptUrl : null,
      setupAutoRenewPrompt: props.record.source === 'legacy',
    };
  }

  return { access: 'none' };
}
