import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PaymentStatus } from '@/generated/prisma/enums';
import type { PaymentStatus as PaymentStatusValue } from '@/generated/prisma/enums';
import {
  markAdminEventPaymentHandledAction,
  resendAdminEventPaymentRequestAction,
} from '@/libs/admin/events/eventAdminActions';
import type { AdminEventRegistrationDto } from '@/libs/admin/events/eventAdminQueries';
import type { AdminEventAccessMode } from '@/libs/admin/events/zenstackEventAccess';
import { formatEasternDateTime } from '@/libs/mit-sailing/easternTimeFormat';
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

function canMarkPaymentHandled(status: RegistrationPaymentStatus): boolean {
  return (
    status === PaymentStatus.checkout_created ||
    status === PaymentStatus.past_due ||
    status === PaymentStatus.pending
  );
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
  const markHandledAction = markAdminEventPaymentHandledAction.bind(
    null,
    props.locale,
    props.slug,
    payment.id
  );
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <AdminEventListStatusBadge tone="neutral">
          {paymentStatusLabel(payment.status, props.t)}
        </AdminEventListStatusBadge>
        <span className="text-sm text-mit-readable-ink">
          {formatUsdMinorUnitsAsCurrency(payment.amountCents, props.locale)}
        </span>
      </div>
      {props.accessMode === 'editable' && payment.resendEligible ? (
        <form action={resendAction}>
          <Button className="w-fit" size="sm" type="submit" variant="outline">
            <Mail aria-hidden className="size-4" />
            {props.t('payment_resend_request')}
          </Button>
        </form>
      ) : null}
      {props.accessMode === 'editable' &&
      canMarkPaymentHandled(payment.status) ? (
        <form action={markHandledAction} className="flex flex-col gap-2">
          <Textarea
            aria-label={props.t('payment_manual_note_label')}
            className="min-h-20"
            name="note"
            placeholder={props.t('payment_manual_note_placeholder')}
            required
          />
          <Button className="w-fit" size="sm" type="submit" variant="outline">
            {props.t('payment_mark_handled')}
          </Button>
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
