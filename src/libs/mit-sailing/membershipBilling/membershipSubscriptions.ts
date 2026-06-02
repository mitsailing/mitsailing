import {
  PaymentStatus,
  SailingCardSubscriptionStatus,
} from '@/generated/prisma/enums';
import type {
  MembershipPaymentIssueKind,
  SailingCardType,
} from '@/generated/prisma/enums';

export type MembershipSubscriptionRow = {
  readonly autoRenew: boolean;
  readonly cancelAtPeriodEnd: boolean;
  readonly canonicalSubscriptionId: string | null;
  readonly cardType: SailingCardType;
  readonly currentPeriodEnd: Date | null;
  readonly id: string;
  readonly status: SailingCardSubscriptionStatus;
  readonly stripeCustomerId: string;
  readonly stripeSubscriptionId: string;
};

export type MembershipPaymentSummaryRow = {
  readonly amountCents: number;
  readonly id: string;
  readonly issueKind: MembershipPaymentIssueKind | null;
  readonly status: PaymentStatus;
  readonly stripeReceiptUrl: string | null;
};

export type MembershipProfileStateKind =
  | 'active_paid'
  | 'cancel_at_period_end'
  | 'canceled'
  | 'free_normal'
  | 'free_normal_active_paid'
  | 'no_paid_membership'
  | 'past_due'
  | 'pending_checkout';

export type MembershipProfileState = {
  readonly accessThrough: Date | null;
  readonly amountCents: number | null;
  readonly canOpenBillingPortal: boolean;
  readonly canTurnOffAutoRenew: boolean;
  readonly cardType: SailingCardType | null;
  readonly kind: MembershipProfileStateKind;
  readonly receiptUrl: string | null;
  readonly stripeCustomerId: string | null;
  readonly stripeSubscriptionId: string | null;
};

const activeSubscriptionStatuses: ReadonlySet<SailingCardSubscriptionStatus> =
  new Set([
    SailingCardSubscriptionStatus.active,
    SailingCardSubscriptionStatus.trialing,
  ]);

function isPaidAccessPayment(payment: MembershipPaymentSummaryRow | null) {
  return (
    payment?.status === PaymentStatus.paid &&
    payment.issueKind !== 'refunded_current_season' &&
    payment.issueKind !== 'disputed_current_season'
  );
}

function baseProfileState(props: {
  readonly kind: MembershipProfileStateKind;
  readonly latestPayment: MembershipPaymentSummaryRow | null;
  readonly subscription: MembershipSubscriptionRow | null;
}): MembershipProfileState {
  return {
    accessThrough: props.subscription?.currentPeriodEnd ?? null,
    amountCents: props.latestPayment?.amountCents ?? null,
    canOpenBillingPortal: props.subscription !== null,
    canTurnOffAutoRenew:
      props.subscription?.autoRenew === true &&
      !props.subscription.cancelAtPeriodEnd &&
      props.subscription.status !== SailingCardSubscriptionStatus.canceled &&
      props.subscription.status !==
        SailingCardSubscriptionStatus.incomplete_expired,
    cardType: props.subscription?.cardType ?? null,
    kind: props.kind,
    receiptUrl: props.latestPayment?.stripeReceiptUrl ?? null,
    stripeCustomerId: props.subscription?.stripeCustomerId ?? null,
    stripeSubscriptionId: props.subscription?.stripeSubscriptionId ?? null,
  };
}

function profileStateWithoutBillingActions(props: {
  readonly kind: MembershipProfileStateKind;
  readonly latestPayment: MembershipPaymentSummaryRow | null;
  readonly subscription: MembershipSubscriptionRow | null;
}) {
  return {
    ...baseProfileState(props),
    canOpenBillingPortal: false,
    canTurnOffAutoRenew: false,
  };
}

function profileStateWithoutAutoRenewAction(props: {
  readonly kind: MembershipProfileStateKind;
  readonly latestPayment: MembershipPaymentSummaryRow | null;
  readonly subscription: MembershipSubscriptionRow | null;
}) {
  return {
    ...baseProfileState(props),
    canTurnOffAutoRenew: false,
  };
}

function inactiveProfileKind(access: 'free_normal' | 'paid_racing_available') {
  return access === 'free_normal' ? 'free_normal' : 'no_paid_membership';
}

export function selectCanonicalMembershipSubscription(
  subscriptions: readonly MembershipSubscriptionRow[]
): MembershipSubscriptionRow | null {
  return (
    subscriptions.find(
      (subscription) =>
        subscription.canonicalSubscriptionId === null &&
        activeSubscriptionStatuses.has(subscription.status)
    ) ??
    subscriptions.find(
      (subscription) => subscription.canonicalSubscriptionId === null
    ) ??
    null
  );
}

export function membershipProfileState(props: {
  readonly access: 'free_normal' | 'paid_racing_available';
  readonly latestPayment: MembershipPaymentSummaryRow | null;
  readonly subscription: MembershipSubscriptionRow | null;
}): MembershipProfileState {
  if (!props.subscription) {
    if (props.latestPayment?.status === PaymentStatus.checkout_created) {
      return baseProfileState({
        kind: 'pending_checkout',
        latestPayment: props.latestPayment,
        subscription: null,
      });
    }
    return baseProfileState({
      kind: inactiveProfileKind(props.access),
      latestPayment: props.latestPayment,
      subscription: null,
    });
  }

  if (
    props.subscription.status === SailingCardSubscriptionStatus.incomplete ||
    props.subscription.status ===
      SailingCardSubscriptionStatus.incomplete_expired
  ) {
    return profileStateWithoutBillingActions({
      kind: 'pending_checkout',
      latestPayment: props.latestPayment,
      subscription: props.subscription,
    });
  }

  if (props.subscription.status === SailingCardSubscriptionStatus.past_due) {
    return baseProfileState({
      kind: 'past_due',
      latestPayment: props.latestPayment,
      subscription: props.subscription,
    });
  }

  if (
    props.subscription.status === SailingCardSubscriptionStatus.canceled ||
    props.subscription.status === SailingCardSubscriptionStatus.unpaid
  ) {
    return profileStateWithoutAutoRenewAction({
      kind: 'canceled',
      latestPayment: props.latestPayment,
      subscription: props.subscription,
    });
  }

  if (
    props.subscription.status === SailingCardSubscriptionStatus.paused ||
    props.subscription.status === SailingCardSubscriptionStatus.duplicate
  ) {
    return profileStateWithoutBillingActions({
      kind: inactiveProfileKind(props.access),
      latestPayment: props.latestPayment,
      subscription: props.subscription,
    });
  }

  if (props.subscription.cancelAtPeriodEnd) {
    return profileStateWithoutAutoRenewAction({
      kind: 'cancel_at_period_end',
      latestPayment: props.latestPayment,
      subscription: props.subscription,
    });
  }

  if (
    props.access === 'free_normal' &&
    isPaidAccessPayment(props.latestPayment)
  ) {
    return baseProfileState({
      kind: 'free_normal_active_paid',
      latestPayment: props.latestPayment,
      subscription: props.subscription,
    });
  }

  return baseProfileState({
    kind: 'active_paid',
    latestPayment: props.latestPayment,
    subscription: props.subscription,
  });
}
