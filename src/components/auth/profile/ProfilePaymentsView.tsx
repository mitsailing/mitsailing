import { ExternalLink } from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import {
  PaymentSource,
  PaymentStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import { Link } from '@/libs/I18nNavigation';
import type { UserPaymentRow } from '@/libs/mit-sailing/userPaymentQueries';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';

type ProfilePaymentsTranslations = Awaited<
  ReturnType<typeof getTranslations<'UserProfilePage'>>
>;

type ProfilePaymentsViewProps = {
  locale: string;
  payments: UserPaymentRow[];
  t: ProfilePaymentsTranslations;
};

function profilePaymentStatusLabel(
  status: UserPaymentRow['status'],
  t: ProfilePaymentsTranslations
): string {
  if (status === PaymentStatus.paid) {
    return t('payments_status_paid');
  }
  if (status === PaymentStatus.handled) {
    return t('payments_status_handled');
  }
  if (status === PaymentStatus.refunded) {
    return t('payments_status_refunded');
  }
  if (status === PaymentStatus.disputed) {
    return t('payments_status_disputed');
  }
  if (status === PaymentStatus.cancelled) {
    return t('payments_status_cancelled');
  }
  if (status === PaymentStatus.needs_review) {
    return t('payments_status_needs_review');
  }
  return t('payments_status_due');
}

const paymentSourceMessageKeys = {
  [PaymentSource.admin_override]: 'payments_source_admin_override',
  [PaymentSource.legacy]: 'payments_source_legacy',
  [PaymentSource.stripe]: 'payments_source_stripe',
} as const satisfies Record<UserPaymentRow['source'], string>;

const paymentCardTypeMessageKeys = {
  [SailingCardType.normal]: 'payments_card_type_normal',
  [SailingCardType.racing]: 'payments_card_type_racing',
  [SailingCardType.team_racing]: 'payments_card_type_team_racing',
} as const satisfies Record<SailingCardType, string>;

function membershipPaymentTitle(
  payment: UserPaymentRow,
  t: ProfilePaymentsTranslations
) {
  if (
    payment.purpose !== 'membership' ||
    !payment.cardType ||
    !payment.cardYear
  ) {
    return null;
  }

  return t('payments_membership_title', {
    cardType: t(paymentCardTypeMessageKeys[payment.cardType]),
    year: payment.cardYear,
  });
}

function paymentTitle(payment: UserPaymentRow, t: ProfilePaymentsTranslations) {
  const membershipTitle = membershipPaymentTitle(payment, t);
  if (membershipTitle) {
    return membershipTitle;
  }

  if (payment.event) {
    return payment.event.name;
  }

  if (payment.legacyDescription) {
    return payment.legacyDescription;
  }

  return t('payments_unknown_title');
}

function receiptFallbackLabel(
  payment: UserPaymentRow,
  t: ProfilePaymentsTranslations
) {
  if (
    payment.source === PaymentSource.legacy &&
    payment.status === PaymentStatus.paid
  ) {
    return t('payments_no_stripe_receipt');
  }
  return t('payments_no_receipt');
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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-sm leading-snug text-mit-text">
          <thead>
            <tr className="text-sm font-bold text-mit-text">
              <th className="w-[42%] px-2 py-2" scope="col">
                {props.t('payments_column_payment')}
              </th>
              <th className="w-[16%] px-2 py-2" scope="col">
                {props.t('payments_column_amount')}
              </th>
              <th className="w-[18%] px-2 py-2" scope="col">
                {props.t('payments_column_status')}
              </th>
              <th className="w-[14%] px-2 py-2" scope="col">
                {props.t('payments_column_source')}
              </th>
              <th className="w-[10%] px-2 py-2 text-right" scope="col">
                {props.t('payments_column_receipt')}
              </th>
            </tr>
          </thead>
          <tbody>
            {props.payments.length === 0 ? (
              <tr className="border-t border-mit-line">
                <td
                  className="px-2 py-4 text-center text-mit-readable-ink"
                  colSpan={5}
                >
                  {props.t('payments_empty_state')}
                </td>
              </tr>
            ) : (
              props.payments.map((payment) => (
                <tr className="border-t border-mit-line" key={payment.id}>
                  <th className="px-2 py-3 font-normal" scope="row">
                    {payment.event ? (
                      <Link
                        className="font-semibold text-mit-red no-underline hover:underline dark:text-mit-red-ink"
                        href={`/events/${payment.event.slug}`}
                      >
                        {paymentTitle(payment, props.t)}
                      </Link>
                    ) : (
                      <span className="font-semibold">
                        {paymentTitle(payment, props.t)}
                      </span>
                    )}
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
                  <td className="px-2 py-3">
                    {props.t(paymentSourceMessageKeys[payment.source])}
                  </td>
                  <td className="px-2 py-3 text-right">
                    {payment.receiptUrl &&
                    payment.status !== PaymentStatus.handled ? (
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
                        {receiptFallbackLabel(payment, props.t)}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
