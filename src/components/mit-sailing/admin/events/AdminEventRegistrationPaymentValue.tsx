import { Mail } from 'lucide-react';
import { SubmitButton } from '@/components/ui/submit-button';
import { PaymentStatus } from '@/generated/prisma/enums';
import type { PaymentStatus as PaymentStatusValue } from '@/generated/prisma/enums';
import { resendAdminEventPaymentRequestAction } from '@/libs/admin/events/eventAdminActions';
import type { AdminEventRegistrationDto } from '@/libs/admin/events/eventAdminQueries';
import type { AdminEventAccessMode } from '@/libs/admin/events/zenstackEventAccess';
import { formatEasternDateTime } from '@/libs/mit-sailing/easternTimeFormat';
import {
  paidAmountCentsForPayment,
  paymentDiscountDisplaySummary,
} from '@/libs/mit-sailing/payments/paymentDisplay';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';
import type { AdminEventRegistrationsTranslations } from './AdminEventRegistrationUtils';
import { AdminEventListStatusBadge } from './AdminEventShared';

type RegistrationPaymentStatus = NonNullable<
  AdminEventRegistrationDto['payment']
>['status'];
type PaymentStatusTranslationKey =
  Parameters<AdminEventRegistrationsTranslations>[0];

const paymentStatusLabelKeys = {
  [PaymentStatus.cancelled]: 'payment_status_cancelled',
  [PaymentStatus.checkout_created]: 'payment_status_checkout_created',
  [PaymentStatus.disputed]: 'payment_status_disputed',
  [PaymentStatus.handled]: 'payment_status_handled',
  [PaymentStatus.paid]: 'payment_status_paid',
  [PaymentStatus.past_due]: 'payment_status_past_due',
  [PaymentStatus.pending]: 'payment_status_pending',
  [PaymentStatus.refunded]: 'payment_status_refunded',
  [PaymentStatus.needs_review]: 'payment_status_needs_review',
} satisfies Record<PaymentStatusValue, PaymentStatusTranslationKey>;

function paymentStatusLabel(
  status: RegistrationPaymentStatus,
  t: AdminEventRegistrationsTranslations
): string {
  return t(paymentStatusLabelKeys[status]);
}

export function AdminEventRegistrationPaymentValue(props: {
  accessMode: AdminEventAccessMode;
  locale: string;
  registration: AdminEventRegistrationDto;
  slug: string;
  t: AdminEventRegistrationsTranslations;
}) {
  const { payment } = props.registration;
  if (!payment) {
    return props.t('payment_not_required');
  }
  const resendAction = resendAdminEventPaymentRequestAction.bind(
    null,
    props.locale,
    props.slug,
    payment.id
  );
  const paidAmountCents = paidAmountCentsForPayment(payment);
  const discount = paymentDiscountDisplaySummary(
    payment.stripeDiscountMetadata
  );
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <AdminEventListStatusBadge tone="neutral">
          {paymentStatusLabel(payment.status, props.t)}
        </AdminEventListStatusBadge>
        <span className="text-sm text-mit-readable-ink">
          {paidAmountCents === payment.amountCents
            ? formatUsdMinorUnitsAsCurrency(payment.amountCents, props.locale)
            : props.t('payment_amount_paid_of_total', {
                paid: formatUsdMinorUnitsAsCurrency(
                  paidAmountCents,
                  props.locale
                ),
                total: formatUsdMinorUnitsAsCurrency(
                  payment.amountCents,
                  props.locale
                ),
              })}
        </span>
      </div>
      {discount ? (
        <p className="text-xs text-mit-readable-ink">
          {props.t('payment_discount_summary', {
            discount:
              discount.label ??
              (discount.amountDiscountCents === null
                ? props.t('payment_discount_applied')
                : formatUsdMinorUnitsAsCurrency(
                    discount.amountDiscountCents,
                    props.locale
                  )),
          })}
        </p>
      ) : null}
      {props.accessMode === 'editable' && payment.resendEligible ? (
        <form action={resendAction}>
          <SubmitButton
            className="w-fit"
            pendingKind="sending"
            size="sm"
            variant="outline"
          >
            <Mail aria-hidden className="size-4" />
            {props.t('payment_resend_request')}
          </SubmitButton>
        </form>
      ) : null}
      {payment.manualHandledNote ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-foreground">
            {props.t('payment_manual_note_summary')}
          </summary>
          <p className="mt-1 break-words text-mit-readable-ink">
            {payment.manualHandledNote}
          </p>
          {payment.manualHandledBy && payment.manualHandledAt ? (
            <p className="mt-1 text-xs text-mit-readable-ink">
              {props.t('payment_manual_note_meta', {
                date: formatEasternDateTime(payment.manualHandledAt),
                name: payment.manualHandledBy.name,
              })}
            </p>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}
