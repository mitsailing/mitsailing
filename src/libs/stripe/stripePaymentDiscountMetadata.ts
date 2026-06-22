type StripePaymentObject = Record<string, unknown>;

type StripeDiscountSummary = {
  readonly amountDiscountCents: number | null;
  readonly couponId: string | null;
  readonly couponName: string | null;
  readonly promotionCode: string | null;
  readonly promotionCodeId: string | null;
};

export type StripePaymentDiscountMetadata = {
  readonly amountDiscountCents: number | null;
  readonly amountPaidCents: number | null;
  readonly amountSubtotalCents: number | null;
  readonly amountTotalCents: number | null;
  readonly discounts: readonly StripeDiscountSummary[];
  readonly totalDetails: StripePaymentObject | null;
};

function objectValue(value: unknown): StripePaymentObject | null {
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

function expandableId(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  return stringValue(objectValue(value)?.id);
}

function discountRows(value: unknown): readonly StripePaymentObject[] {
  return Array.isArray(value)
    ? value.map(objectValue).filter((row) => row !== null)
    : [];
}

function checkoutDiscountRows(object: StripePaymentObject) {
  const totalDetails = objectValue(object.total_details);
  const breakdown = objectValue(totalDetails?.breakdown);
  return [
    ...discountRows(breakdown?.discounts),
    ...discountRows(object.discounts),
  ];
}

function stripeDiscountSummary(
  row: StripePaymentObject
): StripeDiscountSummary {
  const discount = objectValue(row.discount) ?? row;
  const coupon = objectValue(discount.coupon);
  const promotionCode = objectValue(discount.promotion_code);
  return {
    amountDiscountCents: numberValue(row.amount),
    couponId: expandableId(discount.coupon),
    couponName: stringValue(coupon?.name),
    promotionCode: stringValue(promotionCode?.code),
    promotionCodeId: expandableId(discount.promotion_code),
  };
}

/**
 * Returns the paid amount in cents from a Stripe payment object.
 *
 * @param object - Stripe payment object
 * @returns Paid amount in cents, or null when absent
 */
export function stripeObjectPaidAmountCents(object: StripePaymentObject) {
  return (
    numberValue(object.amount_total) ??
    numberValue(object.amount_received) ??
    numberValue(object.amount)
  );
}

/**
 * Builds discount metadata from a Stripe payment object.
 *
 * @param options - Metadata source options
 * @param options.object - Stripe payment object
 * @param options.paymentAmountCents - Original local payment amount before discounts
 * @returns Stripe payment discount metadata, or null when no discount data exists
 */
export function stripePaymentDiscountMetadataFromObject(options: {
  readonly object: StripePaymentObject;
  readonly paymentAmountCents: number;
}): StripePaymentDiscountMetadata | null {
  const amountPaidCents = stripeObjectPaidAmountCents(options.object);
  const totalDetails = objectValue(options.object.total_details);
  const amountDiscountCents =
    numberValue(totalDetails?.amount_discount) ??
    (amountPaidCents === null
      ? null
      : options.paymentAmountCents - amountPaidCents);
  const discounts = checkoutDiscountRows(options.object).map(
    stripeDiscountSummary
  );
  if (
    amountPaidCents === null &&
    amountDiscountCents === null &&
    totalDetails === null &&
    discounts.length === 0
  ) {
    return null;
  }
  return {
    amountDiscountCents,
    amountPaidCents,
    amountSubtotalCents: numberValue(options.object.amount_subtotal),
    amountTotalCents: numberValue(options.object.amount_total),
    discounts,
    totalDetails,
  };
}
