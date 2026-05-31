import type { MembershipPaymentAccessStatus } from '@/libs/mit-sailing/membershipBilling/membershipPaymentStatus';

export type AdminUserMembershipBlocker = {
  readonly href: '#membership-payment-status' | '#sailing-card-status';
  readonly key:
    | 'admin_user_blocker_intro_class'
    | 'admin_user_blocker_legacy_review'
    | 'admin_user_blocker_mit_recreation'
    | 'admin_user_blocker_payment_disputed'
    | 'admin_user_blocker_payment_past_due'
    | 'admin_user_blocker_payment_refunded';
  readonly tone: 'error' | 'warning';
};

type AdminUserMembershipBlockerProps = {
  readonly cardRequest: {
    readonly cardType: 'normal' | 'racing' | 'team_racing';
    readonly paymentBypassNote: string | null;
  } | null;
  readonly introClassRequired: boolean;
  readonly membershipAccess: MembershipPaymentAccessStatus;
  readonly recreationVerificationRequired: boolean;
};

function paymentBlocker(
  access: MembershipPaymentAccessStatus
): AdminUserMembershipBlocker | null {
  if (access.access !== 'blocked') {
    return null;
  }
  if (access.blocker === 'payment_disputed') {
    return {
      href: '#membership-payment-status',
      key: 'admin_user_blocker_payment_disputed',
      tone: 'error',
    };
  }
  if (access.blocker === 'payment_past_due') {
    return {
      href: '#membership-payment-status',
      key: 'admin_user_blocker_payment_past_due',
      tone: 'warning',
    };
  }
  if (access.blocker === 'payment_refunded') {
    return {
      href: '#membership-payment-status',
      key: 'admin_user_blocker_payment_refunded',
      tone: 'error',
    };
  }
  return {
    href: '#membership-payment-status',
    key: 'admin_user_blocker_legacy_review',
    tone: 'warning',
  };
}

export function adminUserMembershipBlockers(
  props: AdminUserMembershipBlockerProps
): AdminUserMembershipBlocker[] {
  const blockers: AdminUserMembershipBlocker[] = [];
  const payment = paymentBlocker(props.membershipAccess);
  if (payment && !props.cardRequest?.paymentBypassNote) {
    blockers.push(payment);
  }
  if (props.recreationVerificationRequired) {
    blockers.push({
      href: '#sailing-card-status',
      key: 'admin_user_blocker_mit_recreation',
      tone: 'warning',
    });
  }
  if (props.introClassRequired) {
    blockers.push({
      href: '#sailing-card-status',
      key: 'admin_user_blocker_intro_class',
      tone: 'warning',
    });
  }
  return blockers;
}
