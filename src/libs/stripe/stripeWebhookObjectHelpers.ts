import { stripeObjectPaidAmountCents } from '@/libs/stripe/stripePaymentDiscountMetadata';

type StripeObject = Record<string, unknown>;

/**
 * Returns a plain object when the value is a non-array object.
 *
 * @param value - Unknown Stripe payload value
 * @returns Plain object or null
 */
export function stripeWebhookObjectValue(value: unknown): StripeObject | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(Object.entries(value));
}

/**
 * Returns a trimmed non-empty string when present.
 *
 * @param value - Unknown Stripe payload value
 * @returns String value or null
 */
export function stripeWebhookStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/**
 * Returns a Stripe expandable id from a string or nested object.
 *
 * @param value - Stripe id or expandable object
 * @returns Id string or null
 */
export function stripeWebhookExpandableId(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  const object = stripeWebhookObjectValue(value);
  return object ? stripeWebhookStringValue(object.id) : null;
}

/**
 * Returns whether a Stripe object currency matches the local payment currency.
 *
 * @param object - Stripe payment object
 * @param payment - Local payment currency
 * @returns Whether currencies match
 */
function stripeObjectMatchesPaymentCurrency(
  object: StripeObject,
  payment: Pick<{ readonly currency: string }, 'currency'>
): boolean {
  const currency = stripeWebhookStringValue(object.currency);
  return currency?.toLowerCase() === payment.currency.toLowerCase();
}

/**
 * Returns whether a Stripe object can satisfy the local payment amount.
 *
 * @param object - Stripe payment object
 * @param payment - Local payment amount and currency
 * @returns Whether the object amount is valid for the payment
 */
export function stripeObjectCanSatisfyPaymentAmount(
  object: StripeObject,
  payment: Pick<
    { readonly amountCents: number; readonly currency: string },
    'amountCents' | 'currency'
  >
): boolean {
  const amount = stripeObjectPaidAmountCents(object);
  return (
    amount !== null &&
    Number.isInteger(amount) &&
    amount >= 0 &&
    amount <= payment.amountCents &&
    stripeObjectMatchesPaymentCurrency(object, payment)
  );
}

/**
 * Returns whether a checkout session reports a satisfied payment state.
 *
 * @param object - Stripe checkout session object
 * @returns Whether checkout payment is complete or not required
 */
export function checkoutSessionPaymentIsSatisfied(
  object: StripeObject
): boolean {
  const paymentStatus = stripeWebhookStringValue(object.payment_status);
  return paymentStatus === 'paid' || paymentStatus === 'no_payment_required';
}
