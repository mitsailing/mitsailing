import {
  paidAmountCentsForPayment,
  paymentDiscountDisplaySummary,
  paymentHasPartialRefund,
  paymentNetPaidAmountCents,
  paymentRefundedAmountCents,
} from '@/libs/mit-sailing/payments/paymentDisplay';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';

type PaymentAmountDisplayPayment = {
  readonly amountCents: number;
  readonly amountPaidCents: number | null;
  readonly refundedAmountCents?: number | null;
  readonly status: string;
  readonly stripeDiscountMetadata?: unknown;
};

type PaymentAmountDisplayLabels = {
  readonly amountPaidOfTotal: (values: {
    paid: string;
    total: string;
  }) => string;
  readonly discountApplied: string;
  readonly discountSummary: (values: { discount: string }) => string;
  readonly partialRefundSummary: (values: {
    net: string;
    refunded: string;
  }) => string;
};

function primaryPaymentAmount(props: {
  readonly hasPartialRefund: boolean;
  readonly labels: PaymentAmountDisplayLabels;
  readonly locale: string;
  readonly paidAmountCents: number;
  readonly payment: PaymentAmountDisplayPayment;
  readonly refundedAmountCents: number;
}) {
  if (props.hasPartialRefund) {
    return props.labels.partialRefundSummary({
      net: formatUsdMinorUnitsAsCurrency(
        paymentNetPaidAmountCents({
          amountCents: props.payment.amountCents,
          amountPaidCents: props.payment.amountPaidCents,
          refundedAmountCents: props.payment.refundedAmountCents ?? null,
        }),
        props.locale
      ),
      refunded: formatUsdMinorUnitsAsCurrency(
        props.refundedAmountCents,
        props.locale
      ),
    });
  }
  if (props.paidAmountCents === props.payment.amountCents) {
    return formatUsdMinorUnitsAsCurrency(
      props.payment.amountCents,
      props.locale
    );
  }
  return props.labels.amountPaidOfTotal({
    paid: formatUsdMinorUnitsAsCurrency(props.paidAmountCents, props.locale),
    total: formatUsdMinorUnitsAsCurrency(
      props.payment.amountCents,
      props.locale
    ),
  });
}

/**
 * Renders a payment amount with optional discount and partial-refund notes.
 *
 * @param props - Payment row and localized label helpers
 * @returns Amount display fragment
 */
export function PaymentAmountDisplay(
  props: Readonly<{
    labels: PaymentAmountDisplayLabels;
    locale: string;
    payment: PaymentAmountDisplayPayment;
  }>
) {
  const paidAmountCents = paidAmountCentsForPayment(props.payment);
  const discount = paymentDiscountDisplaySummary(
    props.payment.stripeDiscountMetadata
  );
  const refundedAmountCents = paymentRefundedAmountCents({
    refundedAmountCents: props.payment.refundedAmountCents ?? null,
  });
  const hasPartialRefund = paymentHasPartialRefund({
    amountCents: props.payment.amountCents,
    amountPaidCents: props.payment.amountPaidCents,
    refundedAmountCents: props.payment.refundedAmountCents ?? null,
    status: props.payment.status,
  });
  const primaryAmount = primaryPaymentAmount({
    hasPartialRefund,
    labels: props.labels,
    locale: props.locale,
    paidAmountCents,
    payment: props.payment,
    refundedAmountCents,
  });

  return (
    <div>
      <span>{primaryAmount}</span>
      {discount ? (
        <span className="mt-1 block text-xs font-normal text-mit-readable-ink">
          {props.labels.discountSummary({
            discount:
              discount.label ??
              (discount.amountDiscountCents === null
                ? props.labels.discountApplied
                : formatUsdMinorUnitsAsCurrency(
                    discount.amountDiscountCents,
                    props.locale
                  )),
          })}
        </span>
      ) : null}
    </div>
  );
}
