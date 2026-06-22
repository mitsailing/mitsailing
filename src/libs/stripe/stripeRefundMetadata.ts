import { PaymentStatus } from '@/generated/prisma/enums';

type StripeRefundObject = Record<string, unknown>;

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isRefundObject(object: StripeRefundObject): boolean {
  return stringValue(object.object) === 'refund';
}

/**
 * Returns cumulative refunded cents from a Stripe charge or refund object.
 *
 * @param object - Stripe charge.refunded or refund.* event object
 * @param existingRefundedAmountCents - Current stored refunded amount
 * @returns Cumulative refunded cents when known
 */
export function stripeCumulativeRefundedAmountCents(
  object: StripeRefundObject,
  existingRefundedAmountCents: number | null
): number | null {
  const amountRefunded = numberValue(object.amount_refunded);
  if (amountRefunded !== null) {
    return amountRefunded;
  }
  const refundAmount = numberValue(object.amount);
  if (refundAmount === null) {
    return existingRefundedAmountCents;
  }
  if (isRefundObject(object)) {
    return (existingRefundedAmountCents ?? 0) + refundAmount;
  }
  return refundAmount;
}

/**
 * Returns the Stripe refund id when the webhook object is a refund.
 *
 * @param object - Stripe refund event object
 * @returns Refund id or null
 */
function stripeRefundIdFromObject(object: StripeRefundObject): string | null {
  if (!isRefundObject(object)) {
    return null;
  }
  return stringValue(object.id);
}

function paidBasisCents(payment: {
  readonly amountCents: number;
  readonly amountPaidCents: number | null;
}) {
  return payment.amountPaidCents ?? payment.amountCents;
}

function paymentIsFullyRefunded(options: {
  readonly payment: {
    readonly amountCents: number;
    readonly amountPaidCents: number | null;
  };
  readonly refundedAmountCents: number;
}) {
  return options.refundedAmountCents >= paidBasisCents(options.payment);
}

/**
 * Builds a payment update for Stripe refund webhook events.
 *
 * @param options - Refund object and current payment snapshot
 * @returns Payment update fields for partial or full refunds
 */
export function paymentRefundUpdateFromStripe(options: {
  readonly clearActiveCheckoutKeyOnFullRefund?: boolean;
  readonly existingRefundedAmountCents: number | null;
  readonly object: StripeRefundObject;
  readonly payment: {
    readonly amountCents: number;
    readonly amountPaidCents: number | null;
  };
}) {
  const refundedAmountCents = stripeCumulativeRefundedAmountCents(
    options.object,
    options.existingRefundedAmountCents
  );
  const stripeRefundId = stripeRefundIdFromObject(options.object);
  if (refundedAmountCents === null) {
    return stripeRefundId ? { stripeRefundId } : {};
  }
  const fullyRefunded = paymentIsFullyRefunded({
    payment: options.payment,
    refundedAmountCents,
  });
  return {
    refundedAmountCents,
    status: fullyRefunded ? PaymentStatus.refunded : PaymentStatus.paid,
    ...(stripeRefundId ? { stripeRefundId } : {}),
    ...(fullyRefunded && options.clearActiveCheckoutKeyOnFullRefund
      ? { activeCheckoutKey: null }
      : {}),
  };
}

/**
 * Builds a payment update for Stripe dispute webhook events.
 *
 * @param options - Dispute update options
 * @returns Payment update fields for disputed payments
 */
export function paymentDisputeUpdateFromStripe(options: {
  readonly clearActiveCheckoutKey?: boolean;
  readonly disputeId?: string | null;
}) {
  return {
    status: PaymentStatus.disputed,
    ...(options.disputeId ? { stripeDisputeId: options.disputeId } : {}),
    ...(options.clearActiveCheckoutKey ? { activeCheckoutKey: null } : {}),
  };
}

/**
 * Extracts a dispute id from a Stripe dispute object.
 *
 * @param object - Stripe dispute event object
 * @returns Dispute id or null
 */
export function stripeDisputeIdFromObject(
  object: StripeRefundObject
): string | null {
  return stringValue(object.id);
}
