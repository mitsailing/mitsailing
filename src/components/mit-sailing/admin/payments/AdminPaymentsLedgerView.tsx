import { ExternalLink, Search } from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PaymentStatus } from '@/generated/prisma/enums';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import type {
  AdminPaymentLedgerData,
  AdminPaymentLedgerFilters,
  AdminPaymentLedgerRow,
} from '@/libs/admin/payments/adminPaymentQueries';
import { Link } from '@/libs/I18nNavigation';
import { formatEasternDateTime } from '@/libs/mit-sailing/easternTimeFormat';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';

type AdminPaymentsTranslations = Awaited<
  ReturnType<typeof getTranslations<'AdminPayments'>>
>;

type AdminPaymentsLedgerViewProps = {
  data: AdminPaymentLedgerData;
  dashboardBaseUrl: string;
  filters: AdminPaymentLedgerFilters;
  locale: string;
  stripeConfigured: boolean;
  t: AdminPaymentsTranslations;
  webhookConfigured: boolean;
};

function paymentStatusLabel(
  status: AdminPaymentLedgerRow['status'],
  t: AdminPaymentsTranslations
): string {
  if (status === PaymentStatus.paid) {
    return t('status_paid');
  }
  if (status === PaymentStatus.handled) {
    return t('status_handled');
  }
  if (status === PaymentStatus.refunded) {
    return t('status_refunded');
  }
  if (status === PaymentStatus.disputed) {
    return t('status_disputed');
  }
  if (status === PaymentStatus.cancelled) {
    return t('status_cancelled');
  }
  if (status === PaymentStatus.past_due) {
    return t('status_past_due');
  }
  if (status === PaymentStatus.checkout_created) {
    return t('status_checkout_created');
  }
  if (status === PaymentStatus.needs_review) {
    return t('status_needs_review');
  }
  return t('status_pending');
}

function StripeDashboardLinks(props: {
  dashboardBaseUrl: string;
  payment: AdminPaymentLedgerRow;
  t: AdminPaymentsTranslations;
}) {
  const paymentIntentHref = props.payment.stripePaymentIntentId
    ? `${props.dashboardBaseUrl}/payments/${props.payment.stripePaymentIntentId}`
    : null;
  const checkoutHref = props.payment.stripeCheckoutSessionId
    ? `${props.dashboardBaseUrl}/checkout/sessions/${props.payment.stripeCheckoutSessionId}`
    : null;

  if (!paymentIntentHref && !checkoutHref) {
    return (
      <span className="text-mit-readable-ink">{props.t('empty_value')}</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 md:justify-end">
      {paymentIntentHref ? (
        <a
          className="inline-flex items-center gap-1 font-semibold text-mit-red no-underline hover:underline dark:text-mit-red-ink"
          href={paymentIntentHref}
          rel="noopener noreferrer"
          target="_blank"
        >
          <ExternalLink aria-hidden className="size-3.5" />
          {props.t('stripe_payment_link')}
        </a>
      ) : null}
      {checkoutHref ? (
        <a
          className="inline-flex items-center gap-1 font-semibold text-mit-red no-underline hover:underline dark:text-mit-red-ink"
          href={checkoutHref}
          rel="noopener noreferrer"
          target="_blank"
        >
          <ExternalLink aria-hidden className="size-3.5" />
          {props.t('stripe_checkout_link')}
        </a>
      ) : null}
    </div>
  );
}

function PaymentLedgerTitle(props: {
  payment: AdminPaymentLedgerRow;
  t: AdminPaymentsTranslations;
}) {
  const title =
    props.payment.event?.name ??
    props.payment.legacyDescription ??
    props.t('legacy_payment_title');

  if (props.payment.event) {
    return (
      <Link
        className="font-semibold break-words text-mit-red no-underline hover:underline dark:text-mit-red-ink"
        href={`/events/${props.payment.event.slug}`}
      >
        {title}
      </Link>
    );
  }

  return (
    <span className="font-semibold break-words text-foreground">{title}</span>
  );
}

function PaymentLedgerLegacyEvidence(props: {
  payment: AdminPaymentLedgerRow;
  t: AdminPaymentsTranslations;
}) {
  const source = [props.payment.legacySourceTable, props.payment.legacySourceId]
    .filter(Boolean)
    .join(' ');
  const details = [source, props.payment.legacyCategory]
    .filter(Boolean)
    .join(' · ');

  if (!details) {
    return null;
  }

  return (
    <p className="mt-1 text-xs break-words text-mit-readable-ink">
      {props.t('legacy_evidence', { details })}
    </p>
  );
}

function PaymentLedgerPayer(props: {
  payment: AdminPaymentLedgerRow;
  t: AdminPaymentsTranslations;
}) {
  const payerName = props.payment.user?.name ?? props.payment.payerName;
  const payerEmail = props.payment.user?.email ?? props.payment.payerEmail;
  const payer = [payerName, payerEmail].filter(Boolean).join(' · ');

  return (
    <p className="mt-1 text-sm break-words text-mit-readable-ink">
      {payer || props.t('empty_value')}
    </p>
  );
}

function HealthSummary(props: {
  data: AdminPaymentLedgerData;
  stripeConfigured: boolean;
  t: AdminPaymentsTranslations;
  webhookConfigured: boolean;
}) {
  return (
    <section
      aria-label={props.t('health_aria')}
      className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-3"
    >
      <div>
        <p className="text-xs font-semibold tracking-wide text-mit-readable-ink uppercase">
          {props.t('health_stripe')}
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">
          {props.stripeConfigured
            ? props.t('health_configured')
            : props.t('health_not_configured')}
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold tracking-wide text-mit-readable-ink uppercase">
          {props.t('health_webhook')}
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">
          {props.webhookConfigured
            ? props.t('health_configured')
            : props.t('health_not_configured')}
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold tracking-wide text-mit-readable-ink uppercase">
          {props.t('health_last_event')}
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">
          {props.data.latestWebhook
            ? props.t('health_last_event_value', {
                date: formatEasternDateTime(
                  props.data.latestWebhook.stripeCreatedAt
                ),
                type: props.data.latestWebhook.eventType,
              })
            : props.t('health_last_event_empty')}
        </p>
      </div>
    </section>
  );
}

export function AdminPaymentsLedgerView(props: AdminPaymentsLedgerViewProps) {
  return (
    <div className="flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-widest text-mit-red uppercase dark:text-mit-red-ink">
          {props.t('eyebrow')}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {props.t('title')}
        </h1>
        <p className="max-w-3xl text-sm text-mit-readable-ink">
          {props.t('intro')}
        </p>
      </header>

      <HealthSummary
        data={props.data}
        stripeConfigured={props.stripeConfigured}
        t={props.t}
        webhookConfigured={props.webhookConfigured}
      />

      <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_220px_auto] md:items-end">
        <label
          className="flex flex-col gap-1.5 text-sm font-medium text-foreground"
          htmlFor="admin-payments-ledger-query"
        >
          {props.t('filter_search')}
          <Input
            defaultValue={props.filters.query ?? ''}
            id="admin-payments-ledger-query"
            name="q"
            placeholder={props.t('filter_search_placeholder')}
          />
        </label>
        <label
          className="flex flex-col gap-1.5 text-sm font-medium text-foreground"
          htmlFor="admin-payments-ledger-status"
        >
          {props.t('filter_status')}
          <select
            className={adminNativeSelectClassName}
            defaultValue={props.filters.status ?? 'all'}
            id="admin-payments-ledger-status"
            name="status"
          >
            <option value="all">{props.t('filter_status_all')}</option>
            {Object.values(PaymentStatus).map((status) => (
              <option key={status} value={status}>
                {paymentStatusLabel(status, props.t)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="mit">
          <Search aria-hidden className="size-4" />
          {props.t('filter_submit')}
        </Button>
      </form>

      {props.data.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-mit-readable-ink">
          {props.t('empty_state')}
        </div>
      ) : (
        <ol className="m-0 list-none divide-y divide-mit-line rounded-lg border border-border bg-card p-0">
          {props.data.rows.map((payment) => (
            <li
              className="grid gap-3 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_130px_150px] md:items-center"
              key={payment.id}
            >
              <div className="min-w-0">
                <PaymentLedgerTitle payment={payment} t={props.t} />
                <PaymentLedgerLegacyEvidence payment={payment} t={props.t} />
                <PaymentLedgerPayer payment={payment} t={props.t} />
              </div>
              <div className="text-sm text-mit-readable-ink">
                <span className="font-semibold text-foreground">
                  {paymentStatusLabel(payment.status, props.t)}
                </span>
                <span className="block">
                  {formatEasternDateTime(payment.createdAt)}
                </span>
              </div>
              <div className="text-sm font-semibold text-foreground tabular-nums">
                {formatUsdMinorUnitsAsCurrency(
                  payment.amountCents,
                  props.locale
                )}
              </div>
              <StripeDashboardLinks
                dashboardBaseUrl={props.dashboardBaseUrl}
                payment={payment}
                t={props.t}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
