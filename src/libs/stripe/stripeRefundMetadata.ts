import { PaymentStatus } from '@/generated/prisma/enums';

type StripeRefundObject = Record<string, unknown>;

type StripeRefundLedgerEntry = {
  readonly amountCents: number;
  readonly id: string;
};

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function objectValue(value: unknown): StripeRefundObject | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(Object.entries(value));
}

function isRefundObject(object: StripeRefundObject): boolean {
  return stringValue(object.object) === 'refund';
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

function chargeCumulativeRefundedAmountCents(
  object: StripeRefundObject
): number | null {
  const direct = numberValue(object.amount_refunded);
  if (direct !== null) {
    return direct;
  }
  const charge = objectValue(object.charge);
  if (charge === null) {
    return null;
  }
  return numberValue(charge.amount_refunded);
}

/**
 * Parses persisted Stripe refund ledger entries from payment storage.
 *
 * @param stripeRefundId - Comma-separated `refundId:amountCents` ledger or legacy refund id
 * @returns Parsed refund ledger entries
 */
export function parseStripeRefundLedger(
  stripeRefundId: string | null | undefined
): readonly StripeRefundLedgerEntry[] {
  if (stripeRefundId === null || stripeRefundId === undefined) {
    return [];
  }
  const trimmed = stripeRefundId.trim();
  if (trimmed.length === 0) {
    return [];
  }
  if (!trimmed.includes(',') && !trimmed.includes(':')) {
    return [{ amountCents: 0, id: trimmed }];
  }
  return trimmed.split(',').flatMap((part) => {
    const [id, amountRaw] = part.split(':');
    if (id === undefined || id.length === 0) {
      return [];
    }
    if (amountRaw === undefined || amountRaw.length === 0) {
      return [{ amountCents: 0, id }];
    }
    const amountCents = Number.parseInt(amountRaw, 10);
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      return [{ amountCents: 0, id }];
    }
    return [{ amountCents, id }];
  });
}

function serializeStripeRefundLedger(
  ledger: readonly StripeRefundLedgerEntry[]
): string | null {
  if (ledger.length === 0) {
    return null;
  }
  return ledger.map((entry) => `${entry.id}:${entry.amountCents}`).join(',');
}

function ledgerHasRefundId(
  ledger: readonly StripeRefundLedgerEntry[],
  refundId: string
) {
  return ledger.some((entry) => entry.id === refundId);
}

function ledgerWithRefundEntry(options: {
  readonly amountCents: number;
  readonly ledger: readonly StripeRefundLedgerEntry[];
  readonly refundId: string;
}) {
  if (ledgerHasRefundId(options.ledger, options.refundId)) {
    return options.ledger;
  }
  return [
    ...options.ledger,
    { amountCents: options.amountCents, id: options.refundId },
  ];
}

function ledgerTotalCents(ledger: readonly StripeRefundLedgerEntry[]) {
  return ledger.reduce((sum, entry) => sum + entry.amountCents, 0);
}

/**
 * Returns cumulative refunded cents from a Stripe charge or refund object.
 *
 * @param object - Stripe charge.refunded or refund.* event object
 * @param existingRefundedAmountCents - Current stored refunded amount
 * @param existingRefundLedger - Previously processed Stripe refund ids and amounts
 * @returns Cumulative refunded cents and updated refund ledger when known
 */
export function stripeCumulativeRefundedAmountCents(
  object: StripeRefundObject,
  existingRefundedAmountCents: number | null,
  existingRefundLedger: readonly StripeRefundLedgerEntry[] = []
): {
  readonly amount: number | null;
  readonly ledger: readonly StripeRefundLedgerEntry[];
} {
  const cumulativeFromCharge = chargeCumulativeRefundedAmountCents(object);
  const refundId = stripeRefundIdFromObject(object);
  const refundAmount = numberValue(object.amount);
  if (cumulativeFromCharge !== null) {
    const ledger =
      refundId !== null && refundAmount !== null
        ? ledgerWithRefundEntry({
            amountCents: refundAmount,
            ledger: existingRefundLedger,
            refundId,
          })
        : existingRefundLedger;
    return { amount: cumulativeFromCharge, ledger };
  }
  if (refundAmount === null) {
    return {
      amount: existingRefundedAmountCents,
      ledger: existingRefundLedger,
    };
  }
  if (isRefundObject(object)) {
    if (
      refundId !== null &&
      ledgerHasRefundId(existingRefundLedger, refundId)
    ) {
      return {
        amount: existingRefundedAmountCents,
        ledger: existingRefundLedger,
      };
    }
    const ledger =
      refundId === null
        ? existingRefundLedger
        : ledgerWithRefundEntry({
            amountCents: refundAmount,
            ledger: existingRefundLedger,
            refundId,
          });
    const incrementalTotal =
      refundId === null
        ? (existingRefundedAmountCents ?? 0) + refundAmount
        : ledgerTotalCents(ledger);
    return { amount: incrementalTotal, ledger };
  }
  return { amount: refundAmount, ledger: existingRefundLedger };
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
  readonly existingRefundLedger?: readonly StripeRefundLedgerEntry[];
  readonly object: StripeRefundObject;
  readonly payment: {
    readonly amountCents: number;
    readonly amountPaidCents: number | null;
  };
}) {
  const refundTotals = stripeCumulativeRefundedAmountCents(
    options.object,
    options.existingRefundedAmountCents,
    options.existingRefundLedger ?? []
  );
  const stripeRefundId = serializeStripeRefundLedger(refundTotals.ledger);
  if (refundTotals.amount === null) {
    return stripeRefundId ? { stripeRefundId } : {};
  }
  const fullyRefunded = paymentIsFullyRefunded({
    payment: options.payment,
    refundedAmountCents: refundTotals.amount,
  });
  return {
    refundedAmountCents: refundTotals.amount,
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
