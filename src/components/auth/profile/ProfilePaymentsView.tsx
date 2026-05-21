import { ExternalLink } from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import { EventPaymentStatus } from '@/generated/prisma/enums';
import { Link } from '@/libs/I18nNavigation';
import type { UserEventPaymentRow } from '@/libs/mit-sailing/userPaymentQueries';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';

type ProfilePaymentsTranslations = Awaited<
  ReturnType<typeof getTranslations<'UserProfilePage'>>
>;

type ProfilePaymentsViewProps = {
  locale: string;
  payments: UserEventPaymentRow[];
  t: ProfilePaymentsTranslations;
};

function profilePaymentStatusLabel(
  status: UserEventPaymentRow['status'],
  t: ProfilePaymentsTranslations
): string {
  if (status === EventPaymentStatus.paid) {
    return t('payments_status_paid');
  }
  if (status === EventPaymentStatus.handled) {
    return t('payments_status_handled');
  }
  if (status === EventPaymentStatus.refunded) {
    return t('payments_status_refunded');
  }
  if (status === EventPaymentStatus.disputed) {
    return t('payments_status_disputed');
  }
  if (status === EventPaymentStatus.cancelled) {
    return t('payments_status_cancelled');
  }
  return t('payments_status_due');
}

export function ProfilePaymentsView(props: ProfilePaymentsViewProps) {
  return (
    <section className="mx-auto max-w-5xl">
      <h1 className="mb-2 font-mit-serif text-3xl font-semibold text-mit-text">
        {props.t('payments_page_heading')}
      </h1>
      <p className="mb-6 text-sm text-mit-readable-ink">
        {props.t('payments_page_intro')}
      </p>
      <table className="w-full table-fixed border-collapse text-left text-sm leading-snug text-mit-text">
        <thead>
          <tr className="text-sm font-bold text-mit-text">
            <th className="w-[42%] px-2 py-2" scope="col">
              {props.t('payments_column_event')}
            </th>
            <th className="w-[18%] px-2 py-2" scope="col">
              {props.t('payments_column_amount')}
            </th>
            <th className="w-[22%] px-2 py-2" scope="col">
              {props.t('payments_column_status')}
            </th>
            <th className="w-[18%] px-2 py-2 text-right" scope="col">
              {props.t('payments_column_receipt')}
            </th>
          </tr>
        </thead>
        <tbody>
          {props.payments.length === 0 ? (
            <tr className="border-t border-mit-line">
              <td
                className="px-2 py-4 text-center text-mit-readable-ink"
                colSpan={4}
              >
                {props.t('payments_empty_state')}
              </td>
            </tr>
          ) : (
            props.payments.map((payment) => (
              <tr className="border-t border-mit-line" key={payment.id}>
                <th className="px-2 py-3 font-normal" scope="row">
                  <Link
                    className="font-semibold text-mit-red no-underline hover:underline dark:text-mit-red-ink"
                    href={`/events/${payment.event.slug}`}
                  >
                    {payment.event.name}
                  </Link>
                </th>
                <td className="px-2 py-3 font-medium tabular-nums">
                  {formatUsdMinorUnitsAsCurrency(
                    payment.amountCents,
                    props.locale
                  )}
                </td>
                <td className="px-2 py-3">
                  {profilePaymentStatusLabel(payment.status, props.t)}
                </td>
                <td className="px-2 py-3 text-right">
                  {payment.receiptUrl &&
                  payment.status !== EventPaymentStatus.handled ? (
                    <a
                      className="inline-flex items-center justify-end gap-1 font-semibold text-mit-red no-underline hover:underline dark:text-mit-red-ink"
                      href={payment.receiptUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <ExternalLink aria-hidden className="size-3.5" />
                      {props.t('payments_receipt_link')}
                    </a>
                  ) : (
                    <span className="text-mit-readable-ink">
                      {props.t('payments_no_receipt')}
                    </span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
