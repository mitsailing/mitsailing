import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EventPaymentStatus } from '@/generated/prisma/enums';
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

type PaymentStatus = NonNullable<
  AdminEventRegistrationDto['payment']
>['status'];
type PaymentStatusTranslationKey =
  Parameters<AdminEventRegistrationsTranslations>[0];

const paymentStatusLabels = {
  [EventPaymentStatus.cancelled]: 'payment_status_cancelled',
  [EventPaymentStatus.checkout_created]: 'payment_status_checkout_created',
  [EventPaymentStatus.disputed]: 'payment_status_disputed',
  [EventPaymentStatus.handled]: 'payment_status_handled',
  [EventPaymentStatus.paid]: 'payment_status_paid',
  [EventPaymentStatus.past_due]: 'payment_status_past_due',
  [EventPaymentStatus.pending]: 'payment_status_pending',
  [EventPaymentStatus.refunded]: 'payment_status_refunded',
} satisfies Record<PaymentStatus, PaymentStatusTranslationKey>;

function paymentStatusLabel(
  status: PaymentStatus,
  t: AdminEventRegistrationsTranslations
): string {
  return t(paymentStatusLabels[status]);
}

function canMarkPaymentHandled(status: PaymentStatus): boolean {
  return (
    status === EventPaymentStatus.checkout_created ||
    status === EventPaymentStatus.past_due ||
    status === EventPaymentStatus.pending
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
