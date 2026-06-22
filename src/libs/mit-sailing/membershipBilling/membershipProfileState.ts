import { PaymentStatus } from '@/generated/prisma/enums';
import type {
  MembershipPaymentIssueKind,
  PaymentSource,
  SailingCardType,
} from '@/generated/prisma/enums';
import { getSailingCardExpirationDate } from '@/libs/mit-sailing/sailingCardValidity';

export type MembershipPaymentSummaryRow = {
  readonly amountCents: number;
  readonly amountPaidCents: number | null;
  readonly cardType: SailingCardType | null;
  readonly cardYear: number | null;
  readonly id: string;
  readonly issueKind: MembershipPaymentIssueKind | null;
  readonly source: PaymentSource;
  readonly status: PaymentStatus;
  readonly stripeReceiptUrl: string | null;
};

export type MembershipProfileStateKind =
  | 'active_paid'
  | 'canceled'
  | 'free_normal'
  | 'free_normal_active_paid'
  | 'no_paid_membership'
  | 'past_due'
  | 'pending_checkout';

export type MembershipProfileState = {
  readonly accessThrough: Date | null;
  readonly amountCents: number | null;
  readonly cardType: SailingCardType | null;
  readonly kind: MembershipProfileStateKind;
  readonly receiptUrl: string | null;
};

function isCurrentSeasonPayment(props: {
  readonly cardYear: number;
  readonly payment: MembershipPaymentSummaryRow | null;
}) {
  return props.payment?.cardYear === props.cardYear;
}

function paidPaymentAmount(payment: MembershipPaymentSummaryRow) {
  return payment.amountPaidCents ?? payment.amountCents;
}

function activePaidState(props: {
  readonly access: 'free_normal' | 'paid_racing_available';
  readonly cardYear: number;
  readonly payment: MembershipPaymentSummaryRow;
}): MembershipProfileState {
  return {
    accessThrough: getSailingCardExpirationDate(props.cardYear),
    amountCents: paidPaymentAmount(props.payment),
    cardType: props.payment.cardType,
    kind:
      props.access === 'free_normal'
        ? 'free_normal_active_paid'
        : 'active_paid',
    receiptUrl: props.payment.stripeReceiptUrl,
  };
}

function inactiveProfileKind(access: 'free_normal' | 'paid_racing_available') {
  return access === 'free_normal' ? 'free_normal' : 'no_paid_membership';
}

function inactiveState(props: {
  readonly access: 'free_normal' | 'paid_racing_available';
  readonly payment: MembershipPaymentSummaryRow | null;
}): MembershipProfileState {
  return {
    accessThrough: null,
    amountCents: props.payment ? paidPaymentAmount(props.payment) : null,
    cardType: props.payment?.cardType ?? null,
    kind: inactiveProfileKind(props.access),
    receiptUrl: props.payment?.stripeReceiptUrl ?? null,
  };
}

export function membershipProfileState(props: {
  readonly access: 'free_normal' | 'paid_racing_available';
  readonly cardYear: number;
  readonly latestPayment: MembershipPaymentSummaryRow | null;
}): MembershipProfileState {
  if (
    !isCurrentSeasonPayment({
      cardYear: props.cardYear,
      payment: props.latestPayment,
    })
  ) {
    return inactiveState({
      access: props.access,
      payment: props.latestPayment,
    });
  }
  const { latestPayment } = props;
  if (latestPayment === null) {
    return inactiveState({
      access: props.access,
      payment: null,
    });
  }

  if (latestPayment.status === PaymentStatus.paid) {
    return activePaidState({
      access: props.access,
      cardYear: props.cardYear,
      payment: latestPayment,
    });
  }

  if (
    latestPayment.status === PaymentStatus.pending ||
    latestPayment.status === PaymentStatus.checkout_created
  ) {
    return {
      accessThrough: null,
      amountCents: paidPaymentAmount(latestPayment),
      cardType: latestPayment.cardType,
      kind: 'pending_checkout',
      receiptUrl: latestPayment.stripeReceiptUrl,
    };
  }

  if (latestPayment.status === PaymentStatus.past_due) {
    return {
      accessThrough: null,
      amountCents: paidPaymentAmount(latestPayment),
      cardType: latestPayment.cardType,
      kind: 'past_due',
      receiptUrl: latestPayment.stripeReceiptUrl,
    };
  }

  if (
    latestPayment.status === PaymentStatus.refunded ||
    latestPayment.status === PaymentStatus.disputed ||
    latestPayment.status === PaymentStatus.cancelled
  ) {
    return {
      accessThrough: null,
      amountCents: paidPaymentAmount(latestPayment),
      cardType: latestPayment.cardType,
      kind: 'canceled',
      receiptUrl: latestPayment.stripeReceiptUrl,
    };
  }

  return inactiveState({
    access: props.access,
    payment: latestPayment,
  });
}
