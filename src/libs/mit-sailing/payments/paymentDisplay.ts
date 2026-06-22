type PaymentDiscountObject = Record<string, unknown>;

export type PaymentDiscountDisplaySummary = {
  readonly amountDiscountCents: number | null;
  readonly label: string | null;
};

function objectValue(value: unknown): PaymentDiscountObject | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(Object.entries(value));
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function discountObjects(value: unknown): readonly PaymentDiscountObject[] {
  return Array.isArray(value)
    ? value.map(objectValue).filter((row) => row !== null)
    : [];
}

function firstDiscountLabel(
  discounts: readonly PaymentDiscountObject[]
): string | null {
  for (const discount of discounts) {
    const label =
      stringValue(discount.promotionCode) ??
      stringValue(discount.couponName) ??
      stringValue(discount.promotionCodeId) ??
      stringValue(discount.couponId);
    if (label) {
      return label;
    }
  }
  return null;
}

export function paidAmountCentsForPayment(payment: {
  readonly amountCents: number;
  readonly amountPaidCents: number | null;
}) {
  return payment.amountPaidCents ?? payment.amountCents;
}

export function paymentRefundedAmountCents(payment: {
  readonly refundedAmountCents: number | null;
}) {
  return payment.refundedAmountCents ?? 0;
}

export function paymentHasPartialRefund(payment: {
  readonly amountCents: number;
  readonly amountPaidCents: number | null;
  readonly refundedAmountCents: number | null;
  readonly status: string;
}) {
  const refundedAmountCents = paymentRefundedAmountCents(payment);
  if (refundedAmountCents <= 0) {
    return false;
  }
  return (
    payment.status === 'paid' &&
    refundedAmountCents < paidAmountCentsForPayment(payment)
  );
}

export function paymentNetPaidAmountCents(payment: {
  readonly amountCents: number;
  readonly amountPaidCents: number | null;
  readonly refundedAmountCents: number | null;
}) {
  return Math.max(
    0,
    paidAmountCentsForPayment(payment) - paymentRefundedAmountCents(payment)
  );
}

export function paymentDiscountDisplaySummary(
  metadata: unknown
): PaymentDiscountDisplaySummary | null {
  const object = objectValue(metadata);
  if (!object) {
    return null;
  }
  const discounts = discountObjects(object.discounts);
  const amountDiscountCents = numberValue(object.amountDiscountCents);
  const label = firstDiscountLabel(discounts);
  if (amountDiscountCents === null && label === null) {
    return null;
  }
  return { amountDiscountCents, label };
}
