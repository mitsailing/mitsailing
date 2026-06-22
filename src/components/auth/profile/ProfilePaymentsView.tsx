import { ExternalLink } from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import {
  PaymentSource,
  PaymentStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import { Link } from '@/libs/I18nNavigation';
import {
  paidAmountCentsForPayment,
  paymentDiscountDisplaySummary,
} from '@/libs/mit-sailing/payments/paymentDisplay';
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

function PaymentAmountValue(props: {
  locale: string;
  payment: UserPaymentRow;
  t: ProfilePaymentsTranslations;
}) {
  const paidAmountCents = paidAmountCentsForPayment(props.payment);
  const discount = paymentDiscountDisplaySummary(
    props.payment.stripeDiscountMetadata
  );
  return (
    <div>
      <span>
        {paidAmountCents === props.payment.amountCents
          ? formatUsdMinorUnitsAsCurrency(
              props.payment.amountCents,
              props.locale
            )
          : props.t('payments_amount_paid_of_total', {
              paid: formatUsdMinorUnitsAsCurrency(
                paidAmountCents,
                props.locale
              ),
              total: formatUsdMinorUnitsAsCurrency(
                props.payment.amountCents,
                props.locale
              ),
            })}
      </span>
      {discount ? (
        <span className="mt-1 block text-xs font-normal text-mit-readable-ink">
          {props.t('payments_discount_summary', {
            discount:
              discount.label ??
              (discount.amountDiscountCents === null
                ? props.t('payments_discount_applied')
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

function ProfilePaymentMobileLabel(props: { readonly label: string }) {
  return (
    <p className="m-0 text-xs font-medium text-muted-foreground md:hidden">
      {props.label}
    </p>
  );
}

function ProfilePaymentReceipt(props: {
  readonly payment: UserPaymentRow;
  readonly t: ProfilePaymentsTranslations;
}) {
  if (
    props.payment.receiptUrl &&
    props.payment.status !== PaymentStatus.handled
  ) {
    return (
      <a
        className="inline-flex items-center gap-1 font-semibold text-mit-red no-underline hover:underline dark:text-mit-red-ink"
        href={props.payment.receiptUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        <ExternalLink aria-hidden className="size-3.5" />
        {props.t('payments_receipt_link')}
      </a>
    );
  }

  return (
    <span className="text-mit-readable-ink">
      {receiptFallbackLabel(props.payment, props.t)}
    </span>
  );
}

function ProfilePaymentRow(props: {
  readonly locale: string;
  readonly payment: UserPaymentRow;
  readonly t: ProfilePaymentsTranslations;
}) {
  return (
    <li className="grid gap-3 py-3 md:grid-cols-[minmax(0,1.7fr)_9rem_8rem_8rem] md:items-start">
      <div className="min-w-0">
        {props.payment.event ? (
          <Link
            className="font-semibold break-words text-mit-red no-underline hover:underline dark:text-mit-red-ink"
            href={`/events/${props.payment.event.slug}`}
          >
            {paymentTitle(props.payment, props.t)}
          </Link>
        ) : (
          <span className="font-semibold break-words">
            {paymentTitle(props.payment, props.t)}
          </span>
        )}
      </div>
      <div>
        <ProfilePaymentMobileLabel label={props.t('payments_column_amount')} />
        <div className="font-medium tabular-nums">
          <PaymentAmountValue
            locale={props.locale}
            payment={props.payment}
            t={props.t}
          />
        </div>
      </div>
      <div>
        <ProfilePaymentMobileLabel label={props.t('payments_column_status')} />
        <p className="m-0">
          {profilePaymentStatusLabel(props.payment.status, props.t)}
        </p>
        <p className="mt-1 text-xs text-mit-readable-ink">
          {props.t(paymentSourceMessageKeys[props.payment.source])}
        </p>
      </div>
      <div>
        <ProfilePaymentMobileLabel label={props.t('payments_column_receipt')} />
        <ProfilePaymentReceipt payment={props.payment} t={props.t} />
      </div>
    </li>
  );
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
      {props.payments.length === 0 ? (
        <p className="m-0 border-y border-mit-line py-4 text-center text-sm text-mit-readable-ink">
          {props.t('payments_empty_state')}
        </p>
      ) : (
        <div className="border-y border-mit-line text-sm leading-snug text-mit-text">
          <div className="hidden grid-cols-[minmax(0,1.7fr)_9rem_8rem_8rem] gap-3 border-b border-mit-line py-2 text-xs font-medium text-muted-foreground md:grid">
            <span>{props.t('payments_column_payment')}</span>
            <span>{props.t('payments_column_amount')}</span>
            <span>{props.t('payments_column_status')}</span>
            <span>{props.t('payments_column_receipt')}</span>
          </div>
          <ol className="m-0 list-none divide-y divide-mit-line p-0">
            {props.payments.map((payment) => (
              <ProfilePaymentRow
                key={payment.id}
                locale={props.locale}
                payment={payment}
                t={props.t}
              />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
